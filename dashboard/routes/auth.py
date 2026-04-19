"""
Auth blueprint — handles Discord OAuth and local admin login.
Merges what was previously in Dissident-api-backend into the Hub.
"""
from __future__ import annotations

import os
import secrets

import requests
from flask import (
    Blueprint,
    redirect,
    render_template,
    request,
    session,
    url_for,
    flash,
    jsonify,
)
from flask_login import login_user, logout_user, login_required, current_user

from dashboard.extensions import db
from dashboard.models import User, AuditLog

auth_bp = Blueprint("auth", __name__)

DISCORD_API = "https://discord.com/api/v10"
DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


# ── Discord OAuth ────────────────────────────────────────────────


@auth_bp.get("/login/discord")
def discord_login():
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    params = {
        "client_id": os.environ["DISCORD_CLIENT_ID"],
        "redirect_uri": os.environ["DISCORD_REDIRECT_URI"],
        "response_type": "code",
        "scope": "identify guilds email",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return redirect(f"{DISCORD_AUTH_URL}?{query}")


@auth_bp.get("/callback")
def discord_callback():
    error = request.args.get("error")
    if error:
        flash("Discord login was cancelled.", "warning")
        return redirect(url_for("auth.login"))

    state = request.args.get("state")
    if state != session.pop("oauth_state", None):
        flash("Invalid OAuth state. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    code = request.args.get("code")
    token_resp = requests.post(
        DISCORD_TOKEN_URL,
        data={
            "client_id": os.environ["DISCORD_CLIENT_ID"],
            "client_secret": os.environ["DISCORD_CLIENT_SECRET"],
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": os.environ["DISCORD_REDIRECT_URI"],
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    token_resp.raise_for_status()
    token_data = token_resp.json()
    access_token = token_data["access_token"]

    user_resp = requests.get(
        f"{DISCORD_API}/users/@me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    user_resp.raise_for_status()
    discord_user = user_resp.json()

    # Upsert user
    user = User.query.filter_by(discord_id=discord_user["id"]).first()
    if not user:
        user = User(
            discord_id=discord_user["id"],
            username=discord_user["username"],
        )
        db.session.add(user)

    db.session.commit()
    login_user(user, remember=True)

    _audit(user.id, "discord_login", ip=request.remote_addr)
    return redirect(url_for("core.dashboard"))


# ── Local admin login ────────────────────────────────────────────


@auth_bp.get("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for("core.dashboard"))
    return render_template("auth/login.html")


@auth_bp.post("/login")
def login_post():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        flash("Invalid username or password.", "danger")
        return render_template("auth/login.html"), 401

    login_user(user, remember=True)
    _audit(user.id, "local_login", ip=request.remote_addr)
    return redirect(url_for("core.dashboard"))


@auth_bp.post("/logout")
@login_required
def logout():
    _audit(current_user.id, "logout", ip=request.remote_addr)
    logout_user()
    return redirect(url_for("auth.login"))


# ── Internal API: current user ───────────────────────────────────


@auth_bp.get("/me")
@login_required
def me():
    return jsonify(
        {
            "id": current_user.id,
            "username": current_user.username,
            "is_admin": current_user.is_admin,
            "discord_id": current_user.discord_id,
        }
    )


# ── Helpers ──────────────────────────────────────────────────────


def _audit(actor_id: int, action: str, ip: str | None = None) -> None:
    log = AuditLog(actor_id=actor_id, action=action, ip_address=ip)
    db.session.add(log)
    db.session.commit()

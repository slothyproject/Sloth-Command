"""
Auth blueprint — Discord OAuth and local admin login.
"""
from __future__ import annotations

import os
import secrets
from urllib.parse import urlencode

import requests
from flask import (
    Blueprint,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_login import current_user, login_required, login_user, logout_user

from dashboard.extensions import db
from dashboard.models import AuditLog, Guild, GuildMember, User

auth_bp = Blueprint("auth", __name__)

DISCORD_API = "https://discord.com/api/v10"
DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


# ── Discord OAuth ────────────────────────────────────────────────


@auth_bp.get("/login/discord")
def discord_login():
    state = secrets.token_urlsafe(24)
    session["oauth_state"] = state
    params = urlencode({
        "client_id": os.environ.get("DISCORD_CLIENT_ID", ""),
        "redirect_uri": os.environ.get("DISCORD_REDIRECT_URI", ""),
        "response_type": "code",
        "scope": "identify guilds email",
        "state": state,
        "prompt": "none",
    })
    return redirect(f"{DISCORD_AUTH_URL}?{params}")


@auth_bp.get("/callback")
def discord_callback():
    if request.args.get("error"):
        flash("Discord login was cancelled.", "warning")
        return redirect(url_for("auth.login"))

    if request.args.get("state") != session.pop("oauth_state", None):
        flash("Invalid OAuth state. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    code = request.args.get("code")
    if not code:
        flash("No authorisation code received.", "danger")
        return redirect(url_for("auth.login"))

    try:
        token_resp = requests.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": os.environ.get("DISCORD_CLIENT_ID", ""),
                "client_secret": os.environ.get("DISCORD_CLIENT_SECRET", ""),
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": os.environ.get("DISCORD_REDIRECT_URI", ""),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        user_resp = requests.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_resp.raise_for_status()
        discord_user = user_resp.json()
    except requests.RequestException:
        flash("Could not contact Discord. Please try again.", "danger")
        return redirect(url_for("auth.login"))

    # Upsert user
    user = User.query.filter_by(discord_id=discord_user["id"]).first()
    if not user:
        user = User(
            discord_id=discord_user["id"],
            username=discord_user["username"],
            discriminator=discord_user.get("discriminator"),
            avatar=discord_user.get("avatar"),
            email=discord_user.get("email"),
        )
        db.session.add(user)
    else:
        user.username = discord_user.get("username", user.username)
        user.discriminator = discord_user.get("discriminator")
        user.avatar = discord_user.get("avatar")
        if discord_user.get("email"):
            user.email = discord_user["email"]

    from datetime import datetime, timezone
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    login_user(user, remember=True)
    _audit(user.id, "discord_login", ip=request.remote_addr)

    next_url = request.args.get("next") or url_for("core.dashboard")
    return redirect(next_url)


# ── Local login ──────────────────────────────────────────────────


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

    if not user.is_active:
        flash("This account is disabled.", "danger")
        return render_template("auth/login.html"), 403

    from datetime import datetime, timezone
    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    login_user(user, remember=True)
    _audit(user.id, "local_login", ip=request.remote_addr)

    next_url = request.args.get("next") or url_for("core.dashboard")
    return redirect(next_url)


@auth_bp.post("/logout")
@login_required
def logout():
    _audit(current_user.id, "logout", ip=request.remote_addr)
    logout_user()
    return redirect(url_for("auth.login"))


@auth_bp.get("/me")
@login_required
def me():
    # Build per-guild role list
    guilds_out = []
    if current_user.is_admin:
        # Admins see all active guilds with admin_override role
        all_guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
        for guild in all_guilds:
            if guild.owner_discord_id == current_user.discord_id:
                role = "owner"
            else:
                member = GuildMember.query.filter_by(
                    guild_id=guild.id, user_id=current_user.id
                ).first()
                role = "manager" if (member and member.can_manage) else "admin_override"
            guilds_out.append({
                "id": guild.id,
                "discord_id": guild.discord_id,
                "name": guild.name,
                "icon_url": guild.icon_url(64),
                "member_count": guild.member_count,
                "is_active": guild.is_active,
                "role": role,
            })
    else:
        # Regular users: only guilds they own or have GuildMember entry with can_manage
        managed = GuildMember.query.filter_by(
            user_id=current_user.id, can_manage=True
        ).all()
        managed_ids = {m.guild_id for m in managed}

        owned = Guild.query.filter_by(
            owner_discord_id=current_user.discord_id, is_active=True
        ).all()
        owned_ids = {g.id for g in owned}

        all_accessible_ids = owned_ids | managed_ids
        accessible_guilds = Guild.query.filter(
            Guild.id.in_(all_accessible_ids), Guild.is_active == True
        ).order_by(Guild.name).all()

        for guild in accessible_guilds:
            role = "owner" if guild.id in owned_ids else "manager"
            guilds_out.append({
                "id": guild.id,
                "discord_id": guild.discord_id,
                "name": guild.name,
                "icon_url": guild.icon_url(64),
                "member_count": guild.member_count,
                "is_active": guild.is_active,
                "role": role,
            })

    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "avatar": current_user.avatar,
        "discord_id": current_user.discord_id,
        "is_admin": current_user.is_admin,
        "guilds": guilds_out,
    })


def _audit(actor_id: int, action: str, ip: str | None = None) -> None:
    entry = AuditLog(actor_id=actor_id, action=action, ip_address=ip)
    db.session.add(entry)
    db.session.commit()

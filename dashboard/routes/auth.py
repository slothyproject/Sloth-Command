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
    current_app,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_login import current_user, login_required, login_user, logout_user

from dashboard.extensions import db, limiter
from dashboard.models import (
    AuditLog,
    FailedLoginAttempt,
    Guild,
    GuildMember,
    OwnerIPAllowlist,
    User,
)
from datetime import datetime, timedelta, timezone

auth_bp = Blueprint("auth", __name__)

DISCORD_API = "https://discord.com/api/v10"
DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


def _apply_owner_overrides(user: User) -> bool:
    owner_usernames_raw = os.environ.get("DASHBOARD_OWNER_USERNAMES", "sirtibbles69")
    owner_usernames = {u.strip().lower() for u in owner_usernames_raw.split(",") if u.strip()}

    owner_ids_raw = os.environ.get("DISCORD_OWNER_IDS", "")
    owner_ids = {i.strip() for i in owner_ids_raw.split(",") if i.strip()}

    admin_ids_raw = os.environ.get("DISCORD_ADMIN_IDS", "")
    admin_ids = {i.strip() for i in admin_ids_raw.split(",") if i.strip()}

    promote_owner = (user.username or "").strip().lower() in owner_usernames
    promote_owner = promote_owner or (bool(user.discord_id) and user.discord_id in owner_ids)

    promote_admin = promote_owner
    promote_admin = promote_admin or (bool(user.discord_id) and user.discord_id in admin_ids)

    changed = False
    if promote_owner and not user.is_owner:
        user.is_owner = True
        changed = True

    if promote_admin and not user.is_admin:
        user.is_admin = True
        changed = True

    return changed


def _resolve_discord_redirect_uri() -> str:
    """Resolve callback URL with a robust fallback if env var is unset."""
    configured = (os.environ.get("DISCORD_REDIRECT_URI") or "").strip()
    if configured:
        return configured

    railway_static = (os.environ.get("RAILWAY_STATIC_URL") or "").strip()
    if railway_static:
        return f"https://{railway_static}/auth/callback"

    # Local/dev fallback based on current request host.
    return url_for("auth.discord_callback", _external=True)


# ── Discord OAuth ────────────────────────────────────────────────


@auth_bp.get("/login/discord")
@limiter.limit("20 per minute")
def discord_login():
    client_id = (os.environ.get("DISCORD_CLIENT_ID") or "").strip()
    if not client_id:
        flash("Discord OAuth is not configured (missing client ID).", "danger")
        return redirect(url_for("auth.login"))

    state = secrets.token_urlsafe(24)
    session["oauth_state"] = state
    redirect_uri = _resolve_discord_redirect_uri()
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "identify guilds email",
        "state": state,
        "prompt": "none",
    })
    return redirect(f"{DISCORD_AUTH_URL}?{params}")


@auth_bp.get("/callback")
@limiter.limit("20 per minute")
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

    client_id = (os.environ.get("DISCORD_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("DISCORD_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        flash("Discord OAuth is not configured (missing client credentials).", "danger")
        return redirect(url_for("auth.login"))

    redirect_uri = _resolve_discord_redirect_uri()

    try:
        token_resp = requests.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        if token_resp.status_code >= 400:
            payload = token_resp.text.lower()
            if "invalid form body" in payload or "redirect_uri" in payload:
                flash(
                    "Discord rejected the callback URL. Check DISCORD_REDIRECT_URI and the OAuth2 redirect URL in Discord Developer Portal.",
                    "danger",
                )
                return redirect(url_for("auth.login"))
            token_resp.raise_for_status()

        access_token = token_resp.json()["access_token"]

        user_resp = requests.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        user_resp.raise_for_status()
        discord_user = user_resp.json()
    except requests.HTTPError as exc:
        response = exc.response
        detail = "Unknown Discord error"
        error_code = ""

        if response is not None:
            try:
                payload = response.json()
                error_code = str(payload.get("error", "")).strip()
                detail = str(payload.get("error_description") or error_code or payload)
            except ValueError:
                detail = response.text.strip() or f"HTTP {response.status_code}"

        current_app.logger.warning(
            "Discord OAuth HTTP error (%s): %s",
            response.status_code if response is not None else "no-status",
            detail,
        )

        if error_code == "invalid_client":
            flash(
                "Discord rejected client credentials. Verify DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in Railway.",
                "danger",
            )
        elif error_code == "invalid_grant":
            flash(
                "Discord rejected the authorization code. This is usually a redirect URI mismatch or reused/expired code.",
                "danger",
            )
        else:
            flash(f"Discord OAuth failed: {detail}", "danger")

        return redirect(url_for("auth.login"))
    except requests.RequestException as exc:
        current_app.logger.warning("Discord OAuth network error: %s", exc)
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

    user.last_login = datetime.now(timezone.utc)
    _apply_owner_overrides(user)
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


def _ip_allowed(user: User, ip: str | None) -> bool:
    """Return False only if the user is an owner and has an allowlist without this IP."""
    if not user.is_owner:
        return True
    entries = OwnerIPAllowlist.query.filter_by(user_id=user.id).all()
    if not entries:
        return True
    if not ip:
        return False
    now = datetime.now(timezone.utc)
    for e in entries:
        if e.expires_at and e.expires_at < now:
            continue
        if e.ip_address == ip:
            return True
    return False


def _brute_force_ok(username: str, ip: str | None) -> bool:
    """Block after 5 failed attempts in the last 15 minutes."""
    window = datetime.now(timezone.utc) - timedelta(minutes=15)
    query = FailedLoginAttempt.query.filter(
        FailedLoginAttempt.username == username,
        FailedLoginAttempt.created_at >= window,
    )
    if ip:
        query = query.filter(FailedLoginAttempt.ip_address == ip)
    return query.count() < 5


def _record_failure(username: str, ip: str | None) -> None:
    db.session.add(FailedLoginAttempt(username=username, ip_address=ip))
    db.session.commit()


@auth_bp.post("/login")
@limiter.limit("10 per minute")
def login_post():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    ip = request.remote_addr

    user = User.query.filter_by(username=username).first()

    # Brute-force gate — check before user lookup so usernames can't be enumerated via timing
    if not _brute_force_ok(username, ip):
        current_app.logger.warning("Brute-force block for user=%s ip=%s", username, ip)
        flash("Too many failed attempts. Try again in 15 minutes.", "danger")
        return render_template("auth/login.html"), 429

    if not user or not user.check_password(password):
        _record_failure(username, ip)
        flash("Invalid username or password.", "danger")
        return render_template("auth/login.html"), 401

    if not user.is_active:
        flash("This account is disabled.", "danger")
        return render_template("auth/login.html"), 403

    if not _ip_allowed(user, ip):
        current_app.logger.warning("IP allowlist block for user=%s ip=%s", username, ip)
        flash("Login from this IP is not allowed.", "danger")
        return render_template("auth/login.html"), 403

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    login_user(user, remember=True)
    _audit(user.id, "local_login", ip=ip)

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
    if _apply_owner_overrides(current_user):
        db.session.commit()

    # Build per-guild role list
    guilds_out = []
    if current_user.is_admin:
        # Pre-fetch all GuildMember rows for this user in a single query.
        admin_member_map: dict[int, bool] = {
            m.guild_id: m.can_manage
            for m in GuildMember.query.filter_by(user_id=current_user.id).all()
        }
        all_guilds = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
        for guild in all_guilds:
            if guild.owner_discord_id == current_user.discord_id:
                role = "owner"
            elif guild.id in admin_member_map:
                role = "manager" if admin_member_map[guild.id] else "admin_override"
            else:
                role = "admin_override"
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
            Guild.id.in_(all_accessible_ids), Guild.is_active.is_(True)
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
        "is_owner": current_user.is_owner,
        "is_admin": current_user.is_admin,
        "guilds": guilds_out,
    })


def _audit(actor_id: int, action: str, ip: str | None = None) -> None:
    entry = AuditLog(actor_id=actor_id, action=action, ip_address=ip)
    db.session.add(entry)
    db.session.commit()

"""
REST API — full bot management API.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, abort, current_app, jsonify, request, stream_with_context, Response
from flask_login import current_user, login_required

from dashboard.extensions import db, redis_client
from dashboard.models import (
    AuditLog, BotEvent, Guild, GuildCommand, GuildMember,
    GuildSettings, ModerationCase, Notification, Ticket, TicketMessage,
    User, UserAIProviderCredential, UserAIProviderUsageStat, DashboardBotCredential,
)
from dashboard.services.bot_state import get_bot_state, push_bot_command
from dashboard.services.dissident_api import call_dissident_api
from dashboard.services.ai_provider import (
    SUPPORTED_AI_PROVIDERS,
    invoke_ai_provider,
    mask_api_key,
    normalize_ai_provider_payload,
    serialize_ai_provider_credential,
    validate_ai_provider_config,
)
from dashboard.services.encryption import decrypt_secret, encrypt_secret
from dashboard.versioning import get_dashboard_version

from sqlalchemy import func as sa_func

api_bp = Blueprint("api", __name__)


# ── Helpers ──────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not (current_user.is_admin or getattr(current_user, "is_owner", False)):
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated


def owner_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not getattr(current_user, "is_owner", False):
            return jsonify({"error": "Owner access required"}), 403
        return f(*args, **kwargs)
    return decorated


def internal_api_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        configured = os.environ.get("BOT_INTERNAL_API_KEY") or os.environ.get("WEBHOOK_SECRET") or ""
        provided = request.headers.get("X-Internal-API-Key", "")
        if not configured or not hmac.compare_digest(provided, configured):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def _user_can_access_guild(guild: Guild | None) -> bool:
    if not guild or not current_user.is_authenticated:
        return False
    if current_user.is_admin:
        return True
    if guild.owner_discord_id and guild.owner_discord_id == getattr(current_user, "discord_id", None):
        return True
    membership = GuildMember.query.filter_by(user_id=current_user.id, guild_id=guild.id).first()
    return membership is not None


def guild_access_required(f):
    """Decorator: user must be admin or have read access to the guild."""
    @wraps(f)
    def decorated(*args, **kwargs):
        guild_id = kwargs.get("guild_id") or request.view_args.get("guild_id")
        if guild_id:
            guild = db.session.get(Guild, guild_id)
            if guild and not _user_can_access_guild(guild):
                return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated


def guild_manage_required(f):
    """Decorator: user must be admin or have manage access to the guild."""
    @wraps(f)
    def decorated(*args, **kwargs):
        guild_id = kwargs.get("guild_id") or request.view_args.get("guild_id")
        if guild_id:
            guild = db.session.get(Guild, guild_id)
            if guild and not current_user.can_manage(guild):
                return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated


def _serialize_mod_case_for_dashboard(case: ModerationCase) -> dict:
    payload = case.to_dict()
    payload["action_type"] = payload.get("action")
    payload["target_discord_id"] = payload.get("target_id")
    payload["moderator_discord_id"] = case.moderator_id
    return payload


def _serialize_ticket_for_dashboard(ticket: Ticket) -> dict:
    payload = ticket.to_dict()
    payload["opened_by_discord_id"] = ticket.opener_id
    return payload


def _audit(action: str, guild_id: int | None = None, target_type: str | None = None,
           target_id: str | None = None, details: dict | None = None):
    entry = AuditLog(
        action=action,
        actor_id=current_user.id if current_user.is_authenticated else None,
        guild_id=guild_id,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)
    db.session.commit()


def _audit_internal(action: str, user: User | None = None, discord_id: str | None = None,
                    details: dict | None = None) -> None:
    entry = AuditLog(
        action=action,
        actor_id=None,
        guild_id=None,
        target_type="user" if user else "discord_user",
        target_id=str(user.id) if user else str(discord_id) if discord_id else None,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)


def _notify_admins(type_: str, title: str, body: str = "", link: str = "", guild_id: int | None = None):
    admins = User.query.filter_by(is_admin=True, is_active=True).all()
    for admin in admins:
        notif = Notification(
            user_id=admin.id,
            guild_id=guild_id,
            type=type_,
            title=title,
            body=body,
            link=link,
        )
        db.session.add(notif)
    db.session.commit()
    # Publish to Redis for real-time SSE
    redis_client.publish("hub:notifications", json.dumps({
        "type": type_, "title": title, "body": body, "link": link
    }))


def push_live_event(
    event_type: str,
    title: str,
    body: str = "",
    severity: str = "info",
    guild_id: int | None = None,
) -> None:
    """Publish a real-time event to the SSE live feed (hub:live_events channel)."""
    redis_client.publish("hub:live_events", json.dumps({
        "type": "live_event",
        "event_type": event_type,
        "title": title,
        "body": body,
        "severity": severity,
        "guild_id": guild_id,
        "ts": datetime.now(timezone.utc).isoformat(),
    }))


def _get_or_create_ai_usage(user: User) -> UserAIProviderUsageStat:
    usage = UserAIProviderUsageStat.query.filter_by(user_id=user.id).first()
    if not usage:
        usage = UserAIProviderUsageStat(user_id=user.id)
        db.session.add(usage)
    return usage


def _normalize_usage_window(now: datetime, usage: UserAIProviderUsageStat) -> None:
    window_start = usage.current_hour_started_at
    if window_start and window_start.tzinfo is None:
        # SQLite commonly returns naive datetimes even when timezone=True.
        window_start = window_start.replace(tzinfo=timezone.utc)
    if not window_start or window_start + timedelta(hours=1) <= now:
        usage.current_hour_started_at = now.replace(minute=0, second=0, microsecond=0)
        usage.requests_this_hour = 0
        usage.tokens_this_hour = 0


def _serialize_user_ai_provider_status(user: User) -> dict:
    payload = serialize_ai_provider_credential(user.ai_provider_credential)
    payload["usage"] = user.ai_provider_usage.to_dict() if user.ai_provider_usage else {
        "current_hour_started_at": None,
        "requests_this_hour": 0,
        "tokens_this_hour": 0,
        "lifetime_requests": 0,
        "lifetime_tokens": 0,
        "last_used_at": None,
        "last_command": None,
        "last_error": None,
        "updated_at": None,
    }
    return payload


# ── Health ───────────────────────────────────────────────────────

@api_bp.get("/ping")
def ping():
    return jsonify({"ok": True, "ts": datetime.now(timezone.utc).isoformat()})


@api_bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "sloth-lee-command-hub", "version": get_dashboard_version()})


@api_bp.get("/version")
def version():
    return jsonify({"version": get_dashboard_version(), "service": "sloth-lee-command-hub"})


@api_bp.get("/public/stats")
def public_stats():
    bot = get_bot_state()
    guild_count = Guild.query.filter_by(is_active=True).count() or bot["guild_count"]
    return jsonify({
        "guilds": guild_count,
        "members": bot["member_count"],
        "bot_online": bot["online"],
        "version": bot["version"],
        "latency_ms": bot["latency_ms"],
    })


# ── Bot state ────────────────────────────────────────────────────

@api_bp.get("/bot")
@login_required
def bot_state_route():
    return jsonify(get_bot_state())


@api_bp.get("/overview")
@login_required
def overview():
    """Dashboard overview — real DB counts + 7-day trends + recent events."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    # Guild visibility filter for non-admins
    if current_user.is_admin:
        guild_ids = None
    else:
        managed_ids = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id).all()]
        owned_ids = [
            g.id for g in Guild.query.filter_by(
                owner_discord_id=current_user.discord_id, is_active=True
            ).all()
        ]
        guild_ids = list(set(managed_ids + owned_ids))

    # Core counts
    server_q = Guild.query.filter_by(is_active=True)
    if guild_ids is not None:
        server_q = server_q.filter(Guild.id.in_(guild_ids))
    servers = server_q.count()

    # Total members — sum of all active guild member_counts
    members_total = server_q.with_entities(sa_func.coalesce(sa_func.sum(Guild.member_count), 0)).scalar() or 0

    # Open tickets
    ticket_q = Ticket.query.filter_by(status="open")
    if guild_ids is not None:
        ticket_q = ticket_q.filter(Ticket.guild_id.in_(guild_ids))
    tickets_open = ticket_q.count()

    # Mod cases this week
    case_q = ModerationCase.query.filter(ModerationCase.created_at >= seven_days_ago)
    if guild_ids is not None:
        case_q = case_q.filter(ModerationCase.guild_id.in_(guild_ids))
    cases_week = case_q.count()

    # 7-day daily trend: tickets created + mod cases per day
    trend = []
    for i in range(6, -1, -1):
        day_start = now - timedelta(days=i + 1)
        day_end = now - timedelta(days=i)
        label = day_start.strftime("%a")

        t_q = Ticket.query.filter(Ticket.created_at >= day_start, Ticket.created_at < day_end)
        if guild_ids is not None:
            t_q = t_q.filter(Ticket.guild_id.in_(guild_ids))

        c_q = ModerationCase.query.filter(
            ModerationCase.created_at >= day_start, ModerationCase.created_at < day_end
        )
        if guild_ids is not None:
            c_q = c_q.filter(ModerationCase.guild_id.in_(guild_ids))

        trend.append({"date": label, "tickets": t_q.count(), "cases": c_q.count()})

    # Recent events from BotEvent table (skip heartbeats)
    event_q = BotEvent.query.filter(BotEvent.event_type != "heartbeat")
    if guild_ids is not None:
        event_q = event_q.filter(
            db.or_(BotEvent.guild_id.in_(guild_ids), BotEvent.guild_id.is_(None))
        )
    recent = event_q.order_by(BotEvent.created_at.desc()).limit(8).all()

    _sev_map = {
        "guild_join": "info", "guild_leave": "warning",
        "mod_action": "warning", "ticket_open": "info",
        "ticket_close": "info", "ticket_message": "info",
    }

    def _event_label(e: BotEvent) -> str:
        p = e.payload or {}
        gn = (e.guild.name if e.guild else None) or p.get("guild_name", "Unknown server")
        if e.event_type == "guild_join":
            return f"Bot joined {gn}"
        if e.event_type == "guild_leave":
            return f"Bot left {gn}"
        if e.event_type == "mod_action":
            return f"{(p.get('action') or 'action').capitalize()} – {p.get('target_name') or '?'} in {gn}"
        if e.event_type == "ticket_open":
            return f"Ticket opened by {p.get('opener_name') or '?'} in {gn}"
        if e.event_type == "ticket_close":
            return f"Ticket closed in {gn}"
        return e.event_type.replace("_", " ").title()

    recent_events = [
        {
            "id": str(e.id),
            "type": e.event_type,
            "message": _event_label(e),
            "severity": _sev_map.get(e.event_type, "info"),
            "timestamp": e.created_at.isoformat(),
        }
        for e in recent
    ]

    # Bot state from Redis (live)
    bot = get_bot_state()

    # Accessible guilds (for dashboard server cards)
    guild_q = Guild.query.filter_by(is_active=True)
    if guild_ids is not None:
        guild_q = guild_q.filter(Guild.id.in_(guild_ids))
    accessible_guilds = guild_q.order_by(Guild.member_count.desc()).limit(20).all()

    # Recent mod cases (last 5 across all visible guilds)
    case_q2 = ModerationCase.query
    if guild_ids is not None:
        case_q2 = case_q2.filter(ModerationCase.guild_id.in_(guild_ids))
    recent_cases_rows = case_q2.order_by(ModerationCase.created_at.desc()).limit(5).all()
    recent_cases = [
        {
            "id": c.id,
            "case_number": c.case_number,
            "action": c.action,
            "target_name": c.target_name,
            "target_id": c.target_id,
            "reason": c.reason,
            "created_at": c.created_at.isoformat(),
            "guild_name": c.guild.name if c.guild else None,
        }
        for c in recent_cases_rows
    ]

    # Recent open tickets (last 5)
    ticket_q2 = Ticket.query.filter_by(status="open")
    if guild_ids is not None:
        ticket_q2 = ticket_q2.filter(Ticket.guild_id.in_(guild_ids))
    recent_ticket_rows = ticket_q2.order_by(Ticket.created_at.desc()).limit(5).all()
    recent_tickets = [
        {
            "id": t.id,
            "ticket_number": t.ticket_number,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat(),
            "assigned_to": t.assigned_to,
            "guild_name": t.guild.name if t.guild else None,
        }
        for t in recent_ticket_rows
    ]

    # Notifications for the current user
    notif_items = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(10)
        .all()
    )
    notif_unread = Notification.query.filter_by(
        user_id=current_user.id, is_read=False
    ).count()

    # Prefer live Redis counts for the headline stats
    live_servers = bot.get("guild_count") or servers
    live_members = bot.get("member_count") or int(members_total)

    return jsonify({
        # Flat fields kept for backward-compat / other consumers
        "servers": servers,
        "members": int(members_total),
        "tickets": tickets_open,
        "cases": cases_week,
        "trend": trend,
        "recent_events": recent_events,
        # Enriched fields for the React dashboard
        "stats": {
            "guilds": live_servers,
            "members": live_members,
            "channels": bot.get("channel_count", 0),
            "commands_today": bot.get("commands_today", 0),
            "uptime": bot.get("uptime", "--"),
            "latency_ms": bot.get("latency_ms", 0),
            "version": bot.get("version", "--"),
            "online": bot.get("online", False),
        },
        "guilds": [g.to_dict() for g in accessible_guilds],
        "recent_cases": recent_cases,
        "recent_tickets": recent_tickets,
        "notifications": {
            "unread": notif_unread,
            "items": [n.to_dict() for n in notif_items],
        },
    })


@api_bp.get("/stats")
@login_required
def stats():
    bot = get_bot_state()
    guild_count = Guild.query.filter_by(is_active=True).count() or bot["guild_count"]
    return jsonify({
        "guilds": guild_count,
        "members": bot["member_count"],
        "channels": bot["channel_count"],
        "commands_today": bot["commands_today"],
        "uptime": bot["uptime"],
        "uptime_seconds": bot["uptime_seconds"],
        "latency_ms": bot["latency_ms"],
        "cog_count": bot["cog_count"],
        "version": bot["version"],
        "online": bot["online"],
        "stale": bot["stale"],
    })


# ── Bot commands (admin) ─────────────────────────────────────────

@api_bp.get("/bot/commands")
@login_required
def bot_commands():
    """List all commands the bot knows about (from Redis state)."""
    bot = get_bot_state()
    return jsonify(bot.get("commands", []))


@api_bp.get("/bot/cogs")
@login_required
def bot_cogs():
    bot = get_bot_state()
    raw = bot.get("commands", [])
    cogs = {}
    for cmd in raw:
        cog = cmd.get("cog", "Unknown")
        cogs.setdefault(cog, []).append(cmd)
    return jsonify([{"cog": k, "commands": v, "count": len(v)} for k, v in sorted(cogs.items())])


# ── Bot control (admin) ──────────────────────────────────────────

@api_bp.post("/bot/command")
@login_required
@admin_required
def send_bot_command():
    data = request.get_json() or {}
    command = data.get("command")
    if not command:
        return jsonify({"error": "command required"}), 400
    allowed = {"sync_guilds", "clear_cache", "reload_config", "restart_cog", "reload_cog", "toggle_cog"}
    if command not in allowed:
        return jsonify({"error": f"unknown command: {command}"}), 400
    push_bot_command(command, data.get("payload", {}))
    _audit(f"bot_command:{command}", details=data.get("payload"))
    return jsonify({"ok": True, "command": command})


@api_bp.get("/bot/invite")
@login_required
def bot_invite():
    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    client_id = (cfg.client_id if cfg and cfg.client_id else os.environ.get("DISCORD_CLIENT_ID", "")).strip()
    perms = 8  # Administrator — or use fine-grained: 1374389534902
    url = f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions={perms}&scope=bot%20applications.commands"
    return jsonify({"url": url, "client_id": client_id})


@api_bp.get("/bot/config")
@login_required
@admin_required
def bot_config_get():
    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    if not cfg:
        return jsonify({
            "configured": False,
            "bot_name": None,
            "client_id": None,
            "application_id": None,
            "public_key": None,
            "guild_id": None,
            "token_hint": None,
            "client_secret_hint": None,
            "status": "not_configured",
            "updated_at": None,
        })
    return jsonify(cfg.to_dict())


@api_bp.post("/bot/config")
@login_required
@owner_required
def bot_config_save():
    payload = request.get_json() or {}

    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    if not cfg:
        cfg = DashboardBotCredential()
        db.session.add(cfg)

    cfg.bot_name = str(payload.get("bot_name", cfg.bot_name or "") or "").strip() or None
    cfg.client_id = str(payload.get("client_id", cfg.client_id or "") or "").strip() or None
    cfg.application_id = str(payload.get("application_id", cfg.application_id or "") or "").strip() or None
    cfg.public_key = str(payload.get("public_key", cfg.public_key or "") or "").strip() or None
    cfg.guild_id = str(payload.get("guild_id", cfg.guild_id or "") or "").strip() or None

    token = str(payload.get("token", "") or "").strip()
    if token:
        try:
            encrypted_token, token_iv = encrypt_secret(token)
        except (RuntimeError, ValueError) as exc:
            return jsonify({"error": str(exc)}), 503
        cfg.encrypted_token = encrypted_token
        cfg.token_iv = token_iv
        cfg.token_hint = mask_api_key(token)

    client_secret = str(payload.get("client_secret", "") or "").strip()
    if client_secret:
        try:
            encrypted_client_secret, client_secret_iv = encrypt_secret(client_secret)
        except (RuntimeError, ValueError) as exc:
            return jsonify({"error": str(exc)}), 503
        cfg.encrypted_client_secret = encrypted_client_secret
        cfg.client_secret_iv = client_secret_iv
        cfg.client_secret_hint = mask_api_key(client_secret)

    cfg.status = "configured"
    cfg.updated_by_user_id = current_user.id

    db.session.commit()
    _audit(
        "bot_config_saved",
        target_type="bot_config",
        target_id=str(cfg.id),
        details={
            "has_token": bool(cfg.encrypted_token),
            "has_client_secret": bool(cfg.encrypted_client_secret),
            "client_id": cfg.client_id,
            "application_id": cfg.application_id,
        },
    )
    return jsonify(cfg.to_dict())


@api_bp.delete("/bot/config/token")
@login_required
@owner_required
def bot_config_clear_token():
    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    if not cfg:
        return jsonify({"error": "Bot config not found"}), 404

    cfg.encrypted_token = None
    cfg.token_iv = None
    cfg.token_hint = None
    cfg.status = "configured"
    cfg.updated_by_user_id = current_user.id

    db.session.commit()
    _audit(
        "bot_config_token_cleared",
        target_type="bot_config",
        target_id=str(cfg.id),
        details={"client_id": cfg.client_id},
    )
    return jsonify(cfg.to_dict())


@api_bp.delete("/bot/config/secrets")
@login_required
@owner_required
def bot_config_clear_secrets():
    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    if not cfg:
        return jsonify({"error": "Bot config not found"}), 404

    cfg.encrypted_token = None
    cfg.token_iv = None
    cfg.token_hint = None
    cfg.encrypted_client_secret = None
    cfg.client_secret_iv = None
    cfg.client_secret_hint = None
    cfg.status = "configured"
    cfg.updated_by_user_id = current_user.id

    db.session.commit()
    _audit(
        "bot_config_secrets_cleared",
        target_type="bot_config",
        target_id=str(cfg.id),
        details={"client_id": cfg.client_id},
    )
    return jsonify(cfg.to_dict())


# ── AI Advisor ──────────────────────────────────────────────────

_ADVISOR_SYSTEM_PROMPT = (
    "You are an expert Discord server architect and community manager. "
    "You help server owners design roles, channels, moderation strategies, "
    "onboarding flows, support ticket systems, and community engagement plans. "
    "Be concise, practical, and specific. Format responses with clear sections "
    "when explaining multi-step plans. Avoid unnecessary filler text."
)


@api_bp.post("/ai/advisor")
@login_required
def ai_advisor_chat():
    credential = UserAIProviderCredential.query.filter_by(user_id=current_user.id).first()
    if not credential or credential.status != "active":
        return jsonify({
            "ok": False,
            "error": "AI provider not configured. Go to Settings → AI Provider to set one up.",
        }), 400

    data = request.get_json() or {}
    message = str(data.get("message") or "").strip()
    if not message:
        return jsonify({"ok": False, "error": "message is required"}), 400

    mode = str(data.get("mode") or "ask").strip()
    guild_id = data.get("guild_id")

    # Rate-limit check
    usage = current_user.ai_provider_usage
    if usage:
        now = datetime.now(timezone.utc)
        window_start = usage.current_hour_started_at
        if window_start and window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=timezone.utc)
        if window_start and window_start + timedelta(hours=1) > now:
            limit = credential.usage_limit_requests_per_hour or 100
            if usage.requests_this_hour >= limit:
                return jsonify({
                    "ok": False,
                    "error": f"Hourly limit of {limit} requests reached. Try again later.",
                }), 429

    # Decrypt API key
    try:
        plain_api_key = decrypt_secret(credential.encrypted_api_key, credential.api_key_iv)
    except Exception:
        return jsonify({"ok": False, "error": "Could not decrypt API key. Re-save your provider settings."}), 503

    # Build optional guild context prefix
    context_prefix = ""
    if guild_id:
        guild = db.session.get(Guild, int(guild_id))
        if guild:
            context_prefix = f"Context: I am working on a Discord server called '{guild.name}'. "

    full_prompt = context_prefix + message
    if mode == "interview":
        full_prompt = (
            "Please ask me a series of clarifying questions (one at a time) to "
            "help me design my Discord server. Start with the first question now. " + full_prompt
        )

    result = invoke_ai_provider(
        provider=credential.provider,
        api_key=plain_api_key,
        model=credential.model,
        base_url=credential.base_url,
        prompt=full_prompt,
        system_prompt=_ADVISOR_SYSTEM_PROMPT,
        max_tokens=800,
        timeout=30,
    )

    # Record usage regardless of success
    _record_ai_usage(
        user=current_user,
        command="ai_advisor",
        success=result.get("ok", False),
        token_count=result.get("prompt_tokens", 0) + result.get("completion_tokens", 0),
        error=result.get("error") if not result.get("ok") else None,
    )

    if not result.get("ok"):
        return jsonify({"ok": False, "error": result.get("error", "AI provider error")}), 502

    return jsonify({
        "ok": True,
        "response": result["text"],
        "model": result["model"],
        "endpoint": result["endpoint"],
        "mode": mode,
    })


def _record_ai_usage(
    *,
    user: User,
    command: str,
    success: bool,
    token_count: int = 0,
    error: str | None = None,
) -> None:
    """Update the user's AI usage counters in-place and commit."""
    now = datetime.now(timezone.utc)
    usage = UserAIProviderUsageStat.query.filter_by(user_id=user.id).first()
    if not usage:
        usage = UserAIProviderUsageStat(user_id=user.id)
        db.session.add(usage)

    window_start = usage.current_hour_started_at
    if window_start and window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=timezone.utc)
    if not window_start or window_start + timedelta(hours=1) <= now:
        usage.current_hour_started_at = now.replace(minute=0, second=0, microsecond=0)
        usage.requests_this_hour = 0
        usage.tokens_this_hour = 0

    usage.requests_this_hour = (usage.requests_this_hour or 0) + 1
    usage.tokens_this_hour = (usage.tokens_this_hour or 0) + token_count
    usage.lifetime_requests = (usage.lifetime_requests or 0) + 1
    usage.lifetime_tokens = (usage.lifetime_tokens or 0) + token_count
    usage.last_used_at = now
    usage.last_command = command
    usage.last_error = error
    db.session.commit()


# ── User AI provider ─────────────────────────────────────────────

@api_bp.get("/user/ai-provider")
@login_required
def user_ai_provider_status():
    payload = _serialize_user_ai_provider_status(current_user)
    payload["supported_providers"] = {
        name: {
            "label": config["label"],
            "default_model": config["default_model"],
            "requires_base_url": config["requires_base_url"],
        }
        for name, config in SUPPORTED_AI_PROVIDERS.items()
    }
    return jsonify(payload)


@api_bp.post("/user/ai-provider/validate")
@login_required
def validate_user_ai_provider():
    try:
        payload = normalize_ai_provider_payload(request.get_json() or {}, require_api_key=True)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400

    validation = validate_ai_provider_config(
        provider=payload["provider"],
        api_key=payload["api_key"],
        model=payload["model"],
        base_url=payload["base_url"],
    )
    status = 200 if validation.get("ok") else 400
    return jsonify(validation), status


@api_bp.post("/user/ai-provider")
@login_required
def save_user_ai_provider():
    try:
        payload = normalize_ai_provider_payload(request.get_json() or {}, require_api_key=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    validation = validate_ai_provider_config(
        provider=payload["provider"],
        api_key=payload["api_key"],
        model=payload["model"],
        base_url=payload["base_url"],
    )
    if not validation.get("ok"):
        return jsonify(validation), 400

    try:
        encrypted_api_key, api_key_iv = encrypt_secret(payload["api_key"])
    except (RuntimeError, ValueError) as exc:
        return jsonify({"error": str(exc)}), 503

    credential = UserAIProviderCredential.query.filter_by(user_id=current_user.id).first()
    if not credential:
        credential = UserAIProviderCredential(user_id=current_user.id)
        db.session.add(credential)

    credential.provider = payload["provider"]
    credential.model = payload["model"]
    credential.base_url = payload["base_url"]
    credential.encrypted_api_key = encrypted_api_key
    credential.api_key_iv = api_key_iv
    credential.key_hint = mask_api_key(payload["api_key"])
    credential.status = "active"
    credential.usage_limit_requests_per_hour = payload["usage_limit_requests_per_hour"]
    credential.last_validated_at = datetime.now(timezone.utc)
    credential.validation_error = None

    db.session.commit()
    _audit(
        "user_ai_provider_saved",
        target_type="ai_provider",
        target_id=str(current_user.id),
        details={
            "provider": credential.provider,
            "model": credential.model,
            "status": credential.status,
        },
    )
    return jsonify(_serialize_user_ai_provider_status(current_user))


@api_bp.post("/user/ai-provider/disable")
@login_required
def disable_user_ai_provider():
    credential = UserAIProviderCredential.query.filter_by(user_id=current_user.id).first()
    if not credential:
        return jsonify({"error": "No AI provider configuration found"}), 404

    credential.status = "disabled"
    credential.validation_error = None
    db.session.commit()
    _audit(
        "user_ai_provider_disabled",
        target_type="ai_provider",
        target_id=str(current_user.id),
        details={"provider": credential.provider},
    )
    return jsonify(_serialize_user_ai_provider_status(current_user))


@api_bp.delete("/user/ai-provider")
@login_required
def delete_user_ai_provider():
    credential = UserAIProviderCredential.query.filter_by(user_id=current_user.id).first()
    if not credential:
        return jsonify({"ok": True, "deleted": False})

    provider = credential.provider
    db.session.delete(credential)
    db.session.commit()
    _audit(
        "user_ai_provider_deleted",
        target_type="ai_provider",
        target_id=str(current_user.id),
        details={"provider": provider},
    )
    return jsonify({"ok": True, "deleted": True})


@api_bp.get("/internal/ai-provider/<string:discord_id>")
@internal_api_required
def internal_ai_provider_by_discord_id(discord_id: str):
    user = User.query.filter_by(discord_id=str(discord_id)).first()
    if not user:
        _audit_internal("internal_ai_provider_lookup_missing_user", discord_id=discord_id)
        db.session.commit()
        return jsonify({"configured": False, "error": "User not linked in hub"}), 404

    credential = user.ai_provider_credential
    if not credential or credential.status != "active":
        _audit_internal(
            "internal_ai_provider_lookup_not_configured",
            user=user,
            discord_id=discord_id,
            details={"status": credential.status if credential else "not_configured"},
        )
        db.session.commit()
        return jsonify({
            "configured": False,
            "status": credential.status if credential else "not_configured",
            "error": "AI provider not configured for this user",
            "usage": user.ai_provider_usage.to_dict() if user.ai_provider_usage else None,
        }), 404

    try:
        api_key = decrypt_secret(credential.encrypted_api_key, credential.api_key_iv)
    except Exception:
        _audit_internal("internal_ai_provider_lookup_decrypt_failed", user=user, discord_id=discord_id)
        db.session.commit()
        return jsonify({"configured": False, "error": "Could not decrypt AI provider secret"}), 503

    usage = _get_or_create_ai_usage(user)
    now = datetime.now(timezone.utc)
    _normalize_usage_window(now, usage)
    _audit_internal("internal_ai_provider_lookup_success", user=user, discord_id=discord_id)
    db.session.commit()

    return jsonify({
        "configured": True,
        "provider": credential.provider,
        "model": credential.model,
        "base_url": credential.base_url,
        "api_key": api_key,
        "usage_limit_requests_per_hour": credential.usage_limit_requests_per_hour,
        "key_hint": credential.key_hint,
        "status": credential.status,
        "usage": usage.to_dict(),
    })


@api_bp.post("/internal/ai-provider/<string:discord_id>/usage")
@internal_api_required
def internal_ai_provider_usage(discord_id: str):
    user = User.query.filter_by(discord_id=str(discord_id)).first()
    if not user:
        _audit_internal("internal_ai_provider_usage_missing_user", discord_id=discord_id)
        db.session.commit()
        return jsonify({"error": "User not linked in hub"}), 404

    payload = request.get_json(silent=True) or {}
    usage = _get_or_create_ai_usage(user)
    now = datetime.now(timezone.utc)
    _normalize_usage_window(now, usage)

    token_count = payload.get("token_count", 0)
    try:
        token_count = max(0, int(token_count))
    except (TypeError, ValueError):
        token_count = 0

    success = bool(payload.get("success", False))
    usage.requests_this_hour += 1
    usage.tokens_this_hour += token_count
    usage.lifetime_requests += 1
    usage.lifetime_tokens += token_count
    usage.last_used_at = now
    usage.last_command = str(payload.get("command") or "aiask").strip() or "aiask"
    usage.last_error = None if success else str(payload.get("error") or "Unknown AI provider error")
    _audit_internal(
        "internal_ai_provider_usage_recorded",
        user=user,
        discord_id=discord_id,
        details={
            "command": usage.last_command,
            "success": success,
            "token_count": token_count,
        },
    )
    db.session.commit()

    return jsonify({"ok": True, "usage": usage.to_dict()})


@api_bp.post("/internal/ai-provider/<string:discord_id>/disable")
@internal_api_required
def internal_disable_ai_provider(discord_id: str):
    user = User.query.filter_by(discord_id=str(discord_id)).first()
    if not user or not user.ai_provider_credential:
        _audit_internal("internal_ai_provider_disable_missing_user", discord_id=discord_id)
        db.session.commit()
        return jsonify({"error": "AI provider not configured"}), 404

    reason = str((request.get_json(silent=True) or {}).get("reason") or "Disabled by bot command").strip()
    user.ai_provider_credential.status = "disabled"
    user.ai_provider_credential.validation_error = reason
    _audit_internal(
        "internal_ai_provider_disabled_by_internal",
        user=user,
        discord_id=discord_id,
        details={"reason": reason},
    )
    db.session.commit()
    return jsonify({"ok": True, "status": user.ai_provider_credential.status})


# ── Guilds ───────────────────────────────────────────────────────

@api_bp.get("/guilds")
@login_required
def guilds():
    if current_user.is_admin:
        qs = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    else:
        # Show only guilds this user can manage
        managed_ids = [m.guild_id for m in GuildMember.query.filter_by(
            user_id=current_user.id
        ).all()]
        # Also include guilds where they're the Discord owner
        owner_guilds = Guild.query.filter_by(
            owner_discord_id=current_user.discord_id, is_active=True
        ).all()
        owner_ids = [g.id for g in owner_guilds]
        all_ids = list(set(managed_ids + owner_ids))
        qs = Guild.query.filter(Guild.id.in_(all_ids)).order_by(Guild.name).all()

    # Fallback to Redis if DB is empty
    if not qs:
        bot = get_bot_state()
        return jsonify([{
            "id": None, "discord_id": g.get("id"), "name": g.get("name"),
            "icon": g.get("icon"), "member_count": g.get("member_count", 0),
            "last_sync": None,
        } for g in bot.get("guilds", [])])

    return jsonify([g.to_dict() for g in qs])


@api_bp.get("/guilds/<int:guild_id>")
@login_required
@guild_access_required
def guild_detail(guild_id: int):
    guild = db.get_or_404(Guild, guild_id)
    data = guild.to_dict()
    data["channel_count"] = guild.channel_count
    data["role_count"] = guild.role_count
    data["owner_discord_id"] = guild.owner_discord_id
    data["bot_joined_at"] = guild.bot_joined_at.isoformat() if guild.bot_joined_at else None
    data["settings"] = _settings_dict(guild.settings) if guild.settings else {}
    data["mod_case_count"] = guild.mod_cases.count()
    data["ticket_count"] = guild.tickets.filter_by(status="open").count()
    return jsonify(data)


# ── Guild settings ───────────────────────────────────────────────

def _settings_dict(s: GuildSettings) -> dict:
    if not s:
        return {}
    return {
        "prefix": s.prefix,
        "language": s.language,
        "timezone": s.timezone,
        "mod_log_channel": s.mod_log_channel,
        "automod_enabled": s.automod_enabled,
        "antinuke_enabled": s.antinuke_enabled,
        "max_warns": s.max_warns,
        "warn_action": s.warn_action,
        "welcome_channel": s.welcome_channel,
        "welcome_message": s.welcome_message,
        "farewell_channel": s.farewell_channel,
        "ticket_channel": s.ticket_channel,
        "ticket_role": s.ticket_role,
        "leveling_enabled": s.leveling_enabled,
        "level_channel": s.level_channel,
        "xp_multiplier": s.xp_multiplier,
        "log_channel": s.log_channel,
        "log_joins": s.log_joins,
        "log_leaves": s.log_leaves,
        "log_moderation": s.log_moderation,
        "log_messages": s.log_messages,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@api_bp.get("/guilds/<int:guild_id>/settings")
@login_required
@guild_access_required
def guild_settings_get(guild_id: int):
    guild = db.get_or_404(Guild, guild_id)
    return jsonify(_settings_dict(guild.settings or GuildSettings()))


@api_bp.patch("/guilds/<int:guild_id>/settings")
@login_required
@guild_manage_required
def guild_settings_update(guild_id: int):
    guild = db.get_or_404(Guild, guild_id)
    data = request.get_json() or {}

    if not guild.settings:
        guild.settings = GuildSettings(guild_id=guild.id)
        db.session.add(guild.settings)

    allowed = {
        "prefix", "language", "timezone", "mod_log_channel", "automod_enabled",
        "antinuke_enabled", "max_warns", "warn_action", "welcome_channel",
        "welcome_message", "farewell_channel", "ticket_channel", "ticket_role",
        "leveling_enabled", "level_channel", "xp_multiplier", "log_channel",
        "log_joins", "log_leaves", "log_moderation", "log_messages",
    }
    changed = {}
    for key, val in data.items():
        if key in allowed and hasattr(guild.settings, key):
            setattr(guild.settings, key, val)
            changed[key] = val

    db.session.commit()
    _audit("guild_settings_update", guild_id=guild_id, details=changed)

    # Push settings update to bot via Redis
    push_bot_command("update_guild_settings", {
        "guild_id": guild.discord_id,
        "settings": changed,
    })

    return jsonify({"ok": True, "updated": list(changed.keys())})


# ── Guild commands ───────────────────────────────────────────────

@api_bp.get("/guilds/<int:guild_id>/commands")
@login_required
@guild_access_required
def guild_commands(guild_id: int):
    db.get_or_404(Guild, guild_id)
    cmds = GuildCommand.query.filter_by(guild_id=guild_id).order_by(GuildCommand.command_name).all()
    return jsonify([{
        "id": c.id,
        "command_name": c.command_name,
        "cog": c.cog,
        "is_enabled": c.is_enabled,
        "cooldown_seconds": c.cooldown_seconds,
    } for c in cmds])


@api_bp.patch("/guilds/<int:guild_id>/commands/<string:cmd_name>")
@login_required
@guild_manage_required
def guild_command_update(guild_id: int, cmd_name: str):
    guild = db.get_or_404(Guild, guild_id)
    cmd = GuildCommand.query.filter_by(guild_id=guild_id, command_name=cmd_name).first()
    if not cmd:
        cmd = GuildCommand(guild_id=guild_id, command_name=cmd_name)
        db.session.add(cmd)

    data = request.get_json() or {}
    if "is_enabled" in data:
        cmd.is_enabled = bool(data["is_enabled"])
    if "cooldown_seconds" in data:
        cmd.cooldown_seconds = int(data["cooldown_seconds"])

    db.session.commit()
    _audit(f"command_{'enable' if cmd.is_enabled else 'disable'}:{cmd_name}", guild_id=guild_id)
    push_bot_command("update_command", {
        "guild_id": guild.discord_id,
        "command": cmd_name,
        "enabled": cmd.is_enabled,
        "cooldown": cmd.cooldown_seconds,
    })
    return jsonify({"ok": True, "command": cmd_name, "enabled": cmd.is_enabled})


# ── Moderation ───────────────────────────────────────────────────

@api_bp.get("/guilds/<int:guild_id>/moderation")
@login_required
@guild_access_required
def guild_moderation(guild_id: int):
    db.get_or_404(Guild, guild_id)
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 25)), 100)
    action_filter = request.args.get("action")
    active_filter = request.args.get("active")

    q = ModerationCase.query.filter_by(guild_id=guild_id)
    if action_filter:
        q = q.filter_by(action=action_filter)
    if active_filter is not None:
        q = q.filter_by(is_active=active_filter.lower() == "true")

    total = q.count()
    cases = q.order_by(ModerationCase.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    items = [_serialize_mod_case_for_dashboard(case) for case in cases.items]
    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "cases": items,
        "items": items,
    })


@api_bp.post("/guilds/<int:guild_id>/moderation/actions")
@login_required
@guild_manage_required
def guild_moderation_action(guild_id: int):
    """Execute a moderation action via the Dissident bot backend."""
    if not getattr(current_user, "discord_id", None):
        return jsonify({"error": "A Discord-linked account is required for moderation actions"}), 400

    guild = db.get_or_404(Guild, guild_id)
    data = request.get_json(silent=True) or {}
    action = str(data.get("action", "ban")).lower()
    user_id = str(data.get("user_id", ""))
    target_name = data.get("target_name")
    reason = data.get("reason")
    delete_messages = bool(data.get("delete_messages", False))

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    json_payload = {
        "guildId": guild.discord_id,
        "userId": user_id,
        "reason": reason,
        "deleteMessages": delete_messages,
    }

    status, result = call_dissident_api("POST", "moderation/ban", current_user, json_payload=json_payload)

    if status < 300:
        case_num = ModerationCase.query.filter_by(guild_id=guild_id).count() + 1
        case = ModerationCase(
            guild_id=guild_id,
            case_number=case_num,
            action=action,
            target_id=user_id,
            target_name=target_name,
            moderator_id=str(current_user.discord_id),
            moderator_name=current_user.username,
            reason=reason,
        )
        db.session.add(case)
        db.session.commit()

    return jsonify(result), status


@api_bp.get("/moderation/global-bans")
@login_required
def get_global_bans():
    """List global bans stored in the hub."""
    cases = ModerationCase.query.filter_by(action="global_ban").order_by(
        ModerationCase.created_at.desc()
    ).limit(100).all()
    return jsonify([c.to_dict() for c in cases])


@api_bp.post("/moderation/global-bans")
@login_required
def create_global_ban():
    """Create a cross-server ban via the Dissident bot backend."""
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("user_id", ""))
    username = data.get("username", "")
    reason = data.get("reason", "")
    evidence = data.get("evidence", "")
    source_guild_id = data.get("source_guild_id")
    delete_messages = bool(data.get("delete_messages", False))

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    guild = db.session.get(Guild, source_guild_id) if source_guild_id else None
    source_guild_discord_id = guild.discord_id if guild else None

    json_payload = {
        "userId": user_id,
        "username": username,
        "reason": reason,
        "evidence": evidence,
        "sourceGuildId": source_guild_discord_id,
        "deleteMessages": delete_messages,
    }

    status, result = call_dissident_api("POST", "moderation/global-ban", current_user, json_payload=json_payload)

    if status < 300:
        case_num = ModerationCase.query.filter_by(guild_id=source_guild_id).count() + 1 if source_guild_id else 1
        case = ModerationCase(
            guild_id=source_guild_id,
            case_number=case_num,
            action="global_ban",
            target_id=user_id,
            target_name=username or None,
            moderator_id=str(getattr(current_user, "discord_id", "") or "") or None,
            moderator_name=current_user.username,
            reason=reason,
        )
        db.session.add(case)
        db.session.commit()

    return jsonify(result), status


@api_bp.get("/moderation/recent")
@login_required
def moderation_recent():
    """Recent mod cases across all guilds the user can see."""
    if current_user.is_admin:
        cases = ModerationCase.query.order_by(
            ModerationCase.created_at.desc()
        ).limit(50).all()
    else:
        managed = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        cases = ModerationCase.query.filter(
            ModerationCase.guild_id.in_(managed)
        ).order_by(ModerationCase.created_at.desc()).limit(50).all()

    return jsonify([{**c.to_dict(), "guild_name": c.guild.name} for c in cases])


# ── Tickets ──────────────────────────────────────────────────────

@api_bp.get("/guilds/<int:guild_id>/tickets")
@login_required
@guild_access_required
def guild_tickets(guild_id: int):
    db.get_or_404(Guild, guild_id)
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 25)), 100)
    status = request.args.get("status")

    q = Ticket.query.filter_by(guild_id=guild_id)
    if status:
        q = q.filter_by(status=status)

    total = q.count()
    tickets = q.order_by(Ticket.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    items = [_serialize_ticket_for_dashboard(ticket) for ticket in tickets.items]
    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "tickets": items,
        "items": items,
    })


@api_bp.patch("/guilds/<int:guild_id>/members/<int:member_id>")
@login_required
@guild_access_required
def guild_member_update(guild_id: int, member_id: int):
    """Update can_manage permission for a hub member in this guild."""
    m = GuildMember.query.filter_by(id=member_id, guild_id=guild_id).first_or_404()
    data = request.get_json(silent=True) or {}
    if "can_manage" in data:
        m.can_manage = bool(data["can_manage"])
    db.session.commit()
    return jsonify({"ok": True, "id": m.id, "can_manage": m.can_manage})


@api_bp.get("/guilds/<int:guild_id>/members")
@login_required
@guild_access_required
def guild_members_list(guild_id: int):
    """Return hub users who have access to manage this guild."""
    db.get_or_404(Guild, guild_id)
    members = GuildMember.query.filter_by(guild_id=guild_id).all()
    result = []
    for m in members:
        u = m.user
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "username": u.username if u else "—",
            "discord_id": u.discord_id if u else None,
            "is_admin": u.is_admin if u else False,
            "can_manage": m.can_manage,
            "added_at": m.added_at.isoformat() if m.added_at else None,
        })
    return jsonify({"total": len(result), "members": result})


@api_bp.get("/tickets/recent")
@login_required
def tickets_recent():
    if current_user.is_admin:
        tickets = Ticket.query.filter_by(status="open").order_by(
            Ticket.created_at.desc()
        ).limit(50).all()
    else:
        managed = [m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]
        tickets = Ticket.query.filter(
            Ticket.guild_id.in_(managed), Ticket.status == "open"
        ).order_by(Ticket.created_at.desc()).limit(50).all()

    return jsonify([{**t.to_dict(), "guild_name": t.guild.name} for t in tickets])


@api_bp.post("/tickets/<int:ticket_id>/reply")
@login_required
def ticket_reply(ticket_id: int):
    """Add a staff reply message to a ticket transcript."""
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content is required"}), 400
    msg = TicketMessage(
        ticket_id=ticket_id,
        author_name=current_user.username,
        content=content,
        is_staff=True,
    )
    db.session.add(msg)
    ticket.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({
        "id": msg.id,
        "author_name": msg.author_name,
        "content": msg.content,
        "is_staff": msg.is_staff,
        "created_at": msg.created_at.isoformat(),
    }), 201


@api_bp.get("/tickets/<int:ticket_id>/messages")
@login_required
def ticket_messages(ticket_id: int):
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403
    msgs = ticket.messages.order_by(TicketMessage.created_at.asc()).all()
    return jsonify([{
        "id": m.id,
        "author_name": m.author_name,
        "content": m.content,
        "is_staff": m.is_staff,
        "created_at": m.created_at.isoformat(),
    } for m in msgs])


@api_bp.get("/tickets/<int:ticket_id>")
@login_required
def ticket_detail(ticket_id: int):
    """Return metadata for a single ticket."""
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403
    data = ticket.to_dict()
    data["guild_name"] = guild.name if guild else None
    data["opener_id"] = ticket.opener_id
    data["opener_name"] = ticket.opener_name
    data["closed_by"] = ticket.closed_by
    data["closed_reason"] = ticket.closed_reason
    data["closed_at"] = ticket.closed_at.isoformat() if ticket.closed_at else None
    return jsonify(data)




@api_bp.post("/tickets/<int:ticket_id>/close")
@login_required
def ticket_close(ticket_id: int):
    return _ticket_set_status(ticket_id, "closed", None)


def _ticket_set_status(ticket_id: int, status: str, reason: str | None):
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403

    next_status = (status or "").strip().lower()
    if next_status not in {"open", "resolved", "closed"}:
        return jsonify({"error": "Invalid status"}), 400

    ticket.status = next_status
    if next_status == "closed":
        ticket.closed_by = current_user.username
        ticket.closed_reason = reason
        ticket.closed_at = datetime.now(timezone.utc)
    else:
        ticket.closed_by = None
        ticket.closed_reason = None
        ticket.closed_at = None

    db.session.commit()
    _audit(
        "ticket_status_update",
        guild_id=ticket.guild_id,
        target_type="ticket",
        target_id=str(ticket_id),
        details={"status": next_status, "reason": reason},
    )
    return jsonify({"ok": True, "status": ticket.status, "closed_at": ticket.closed_at.isoformat() if ticket.closed_at else None})


@api_bp.post("/tickets/<int:ticket_id>/status")
@login_required
def ticket_set_status(ticket_id: int):
    payload = request.get_json(silent=True) or {}
    return _ticket_set_status(ticket_id, payload.get("status", ""), payload.get("reason"))


@api_bp.post("/tickets/<int:ticket_id>/assign")
@login_required
def ticket_assign(ticket_id: int):
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    assignee = str(payload.get("assigned_to") or "").strip()
    if assignee and len(assignee) > 100:
        return jsonify({"error": "assigned_to is too long"}), 400

    ticket.assigned_to = assignee or None
    db.session.commit()
    _audit(
        "ticket_assignment_update",
        guild_id=ticket.guild_id,
        target_type="ticket",
        target_id=str(ticket_id),
        details={"assigned_to": ticket.assigned_to},
    )
    return jsonify({"ok": True, "assigned_to": ticket.assigned_to})


@api_bp.get("/tickets/<int:ticket_id>/transcript")
@login_required
def ticket_transcript(ticket_id: int):
    """Return a plain-text transcript of all messages in a ticket."""
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        abort(403)

    messages = (
        TicketMessage.query
        .filter_by(ticket_id=ticket_id)
        .order_by(TicketMessage.created_at.asc())
        .all()
    )

    lines: list[str] = [
        f"=== Ticket #{ticket.ticket_number}: {ticket.subject or 'No subject'} ===",
        f"Opened by: {ticket.opener_name or ticket.opener_id}",
        f"Status: {ticket.status}",
        f"Priority: {ticket.priority}",
        f"Opened: {ticket.created_at.strftime('%Y-%m-%d %H:%M UTC')}",
        "" ,
        "─" * 60,
        "",
    ]
    for msg in messages:
        prefix = "[STAFF] " if msg.is_staff else ""
        ts = msg.created_at.strftime("%Y-%m-%d %H:%M UTC")
        lines.append(f"[{ts}] {prefix}{msg.author_name or msg.author_id}")
        lines.append(msg.content)
        lines.append("")

    if not messages:
        lines.append("(no messages)")

    filename = f"ticket-{ticket.ticket_number}-transcript.txt"
    text = "\n".join(lines)
    return Response(
        text,
        mimetype="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Analytics ────────────────────────────────────────────────────

@api_bp.get("/analytics/summary")
@login_required
def analytics_summary():
    """Return analytics for the requested range with zero-filled daily timelines."""
    range_param = request.args.get("range", "7d")
    days_map = {"7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(range_param, 7)
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)

    # Build day labels for the full range (oldest → newest)
    from datetime import date as _date
    day_labels: list[_date] = [
        (_date.today() - timedelta(days=days - 1 - i)) for i in range(days)
    ]

    def _fmt(d: _date) -> str:
        return d.strftime("%b %d")

    # ── Guild visibility filter ──────────────────────────────────
    if current_user.is_admin:
        guild_filter = None
    else:
        managed_ids = [
            m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id).all()
        ]
        owned_ids = [
            g.id for g in Guild.query.filter_by(
                owner_discord_id=current_user.discord_id, is_active=True
            ).all()
        ]
        guild_filter = list(set(managed_ids + owned_ids))

    def _mod_q():
        q = ModerationCase.query.filter(ModerationCase.created_at >= since)
        if guild_filter is not None:
            q = q.filter(ModerationCase.guild_id.in_(guild_filter))
        return q

    def _ticket_q():
        q = Ticket.query.filter(Ticket.created_at >= since)
        if guild_filter is not None:
            q = q.filter(Ticket.guild_id.in_(guild_filter))
        return q

    def _event_q(event_type: str):
        q = BotEvent.query.filter(
            BotEvent.event_type == event_type,
            BotEvent.created_at >= since,
        )
        if guild_filter is not None:
            q = q.filter(
                db.or_(BotEvent.guild_id.in_(guild_filter), BotEvent.guild_id.is_(None))
            )
        return q

    # ── Moderation actions by type ───────────────────────────────
    action_rows = (
        _mod_q()
        .with_entities(ModerationCase.action, sa_func.count(ModerationCase.id).label("n"))
        .group_by(ModerationCase.action)
        .order_by(sa_func.count(ModerationCase.id).desc())
        .all()
    )
    action_counts = [{"action": (row.action or "unknown").title(), "count": row.n} for row in action_rows]

    # ── Moderation timeline (zero-filled) ────────────────────────
    trunc_day = sa_func.date_trunc("day", ModerationCase.created_at)
    mod_day_rows = (
        _mod_q()
        .with_entities(trunc_day.label("day"), sa_func.count(ModerationCase.id).label("n"))
        .group_by("day")
        .order_by("day")
        .all()
    )
    mod_day_map: dict[_date, int] = {}
    for row in mod_day_rows:
        if row.day:
            d = row.day.date() if hasattr(row.day, "date") else row.day
            mod_day_map[d] = row.n
    action_timeline = [{"date": _fmt(d), "count": mod_day_map.get(d, 0)} for d in day_labels]

    # ── Ticket timeline (zero-filled) ────────────────────────────
    trunc_day_t = sa_func.date_trunc("day", Ticket.created_at)
    ticket_day_rows = (
        _ticket_q()
        .with_entities(trunc_day_t.label("day"), sa_func.count(Ticket.id).label("n"))
        .group_by("day")
        .order_by("day")
        .all()
    )
    ticket_day_map: dict[_date, int] = {}
    for row in ticket_day_rows:
        if row.day:
            d = row.day.date() if hasattr(row.day, "date") else row.day
            ticket_day_map[d] = row.n
    ticket_timeline = [{"date": _fmt(d), "count": ticket_day_map.get(d, 0)} for d in day_labels]

    # ── Guild join/leave timeline (zero-filled) ──────────────────
    def _event_day_map(event_type: str) -> dict[_date, int]:
        trunc_d = sa_func.date_trunc("day", BotEvent.created_at)
        rows = (
            _event_q(event_type)
            .with_entities(trunc_d.label("day"), sa_func.count(BotEvent.id).label("n"))
            .group_by("day")
            .order_by("day")
            .all()
        )
        result: dict[_date, int] = {}
        for row in rows:
            if row.day:
                d = row.day.date() if hasattr(row.day, "date") else row.day
                result[d] = row.n
        return result

    join_map = _event_day_map("guild_join")
    leave_map = _event_day_map("guild_leave")
    server_timeline = [
        {
            "date": _fmt(d),
            "joins": join_map.get(d, 0),
            "leaves": leave_map.get(d, 0),
        }
        for d in day_labels
    ]

    # ── Ticket status and priority counts ────────────────────────
    status_rows = (
        _ticket_q()
        .with_entities(Ticket.status, sa_func.count(Ticket.id).label("n"))
        .group_by(Ticket.status)
        .all()
    )
    ticket_status_counts = [{"status": (row.status or "unknown").capitalize(), "count": row.n} for row in status_rows]

    priority_rows = (
        _ticket_q()
        .with_entities(Ticket.priority, sa_func.count(Ticket.id).label("n"))
        .group_by(Ticket.priority)
        .all()
    )
    ticket_priority_counts = [{"priority": (row.priority or "normal").capitalize(), "count": row.n} for row in priority_rows]

    # ── Top guilds by mod case activity in range ─────────────────
    top_guild_rows = (
        _mod_q()
        .with_entities(ModerationCase.guild_id, sa_func.count(ModerationCase.id).label("n"))
        .group_by(ModerationCase.guild_id)
        .order_by(sa_func.count(ModerationCase.id).desc())
        .limit(5)
        .all()
    )
    top_guilds = []
    for row in top_guild_rows:
        g = db.session.get(Guild, row.guild_id) if row.guild_id else None
        top_guilds.append({
            "id": row.guild_id,
            "name": g.name if g else "Unknown",
            "count": row.n,
        })

    # ── Commands timeline from BotEvent (event_type="command_use") ──
    cmd_day_rows = (
        _event_q("command_use")
        .with_entities(
            sa_func.date_trunc("day", BotEvent.created_at).label("day"),
            sa_func.count(BotEvent.id).label("n"),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    cmd_day_map: dict[_date, int] = {}
    for row in cmd_day_rows:
        if row.day:
            d = row.day.date() if hasattr(row.day, "date") else row.day
            cmd_day_map[d] = row.n
    commands_timeline = [{"date": _fmt(d), "count": cmd_day_map.get(d, 0)} for d in day_labels]

    # ── Top commands by usage count ──────────────────────────────
    cmd_events = (
        _event_q("command_use")
        .with_entities(BotEvent.payload, sa_func.count(BotEvent.id).label("n"))
        .all()
    )
    cmd_name_counts: dict[str, int] = {}
    for row in cmd_events:
        raw_payload = row.payload
        if isinstance(raw_payload, str):
            try:
                raw_payload = json.loads(raw_payload)
            except Exception:
                raw_payload = {}
        name = (raw_payload or {}).get("command_name") or (raw_payload or {}).get("command") or "unknown"
        cmd_name_counts[name] = cmd_name_counts.get(name, 0) + row.n
    top_commands = sorted(
        [{"command": k, "count": v} for k, v in cmd_name_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # ── Top moderators by case count ─────────────────────────────
    top_mod_rows = (
        _mod_q()
        .with_entities(
            ModerationCase.moderator_discord_id,
            sa_func.count(ModerationCase.id).label("n"),
        )
        .group_by(ModerationCase.moderator_discord_id)
        .order_by(sa_func.count(ModerationCase.id).desc())
        .limit(10)
        .all()
    )
    top_moderators = [
        {"moderator": row.moderator_discord_id or "system", "count": row.n}
        for row in top_mod_rows
    ]

    # ── Totals (all-time, scoped to visible guilds) ───────────────
    total_mod_q = ModerationCase.query
    total_ticket_q = Ticket.query
    if guild_filter is not None:
        total_mod_q = total_mod_q.filter(ModerationCase.guild_id.in_(guild_filter))
        total_ticket_q = total_ticket_q.filter(Ticket.guild_id.in_(guild_filter))

    server_q = Guild.query.filter_by(is_active=True)
    if guild_filter is not None:
        server_q = server_q.filter(Guild.id.in_(guild_filter))

    totals = {
        "servers": server_q.count(),
        "members": int(server_q.with_entities(sa_func.coalesce(sa_func.sum(Guild.member_count), 0)).scalar() or 0),
        "mod_cases_all_time": total_mod_q.count(),
        "tickets_all_time": total_ticket_q.count(),
        "tickets_open": total_ticket_q.filter(Ticket.status == "open").count(),
    }

    # ── Bot state from Redis (written every 2s by the live bot) ──
    bot = get_bot_state()
    health = bot.get("health") or {}

    # ── Guild member breakdown ─────────────────────────────────────
    # Primary: Redis guild list (always live, bot writes member_count every 2s)
    redis_guilds = bot.get("guilds", [])
    if redis_guilds:
        guilds_by_members = sorted(
            [
                {
                    "name": g.get("name", "Unknown"),
                    "members": g.get("member_count", 0),
                    "id": g.get("id", ""),
                }
                for g in redis_guilds
                if g.get("member_count", 0) > 0
            ],
            key=lambda x: x["members"],
            reverse=True,
        )[:10]
    else:
        # Fallback to DB when Redis bot state is unavailable
        guilds_by_members = [
            {"name": g.name, "members": g.member_count or 0, "id": str(g.id)}
            for g in server_q.order_by(Guild.member_count.desc()).limit(10).all()
            if (g.member_count or 0) > 0
        ]

    # ── Use live Redis counts for totals (more accurate than DB aggregates) ──
    live_servers = bot.get("guild_count", 0)
    live_members = bot.get("member_count", 0)

    # Fill totals — prefer Redis live counts for servers/members
    totals["servers"] = live_servers or totals["servers"]
    totals["members"] = live_members or totals["members"]

    bot_health = {
        "online": bot.get("online", False),
        "uptime": bot.get("uptime", "offline"),
        "uptime_seconds": bot.get("uptime_seconds", 0),
        "latency_ms": bot.get("latency_ms", 0),
        "commands_today": bot.get("commands_today", 0),
        "cog_count": bot.get("cog_count", 0),
        "version": bot.get("version", "unknown"),
        "guild_count": bot.get("guild_count", 0),
        "member_count": bot.get("member_count", 0),
        "cpu_percent": health.get("cpu_percent", 0),
        "memory_percent": health.get("memory_percent", 0),
        "memory_mb": health.get("memory_mb", 0),
    }

    return jsonify({
        "range": range_param,
        "days": days,
        "since": since.isoformat(),
        "totals": totals,
        "bot_health": bot_health,
        "guilds_by_members": guilds_by_members,
        "action_counts": action_counts,
        "action_timeline": action_timeline,
        "ticket_timeline": ticket_timeline,
        "server_timeline": server_timeline,
        "ticket_status_counts": ticket_status_counts,
        "ticket_priority_counts": ticket_priority_counts,
        "top_guilds": top_guilds,
        "commands_timeline": commands_timeline,
        "top_commands": top_commands,
        "top_moderators": top_moderators,
    })


# ── Webhook (bot → hub) ──────────────────────────────────────────

@api_bp.post("/webhook/bot")
def bot_webhook():
    """Bot posts events here. Verified with HMAC-SHA256."""
    secret = os.environ.get("WEBHOOK_SECRET", "")
    if secret:
        sig = request.headers.get("X-Hub-Signature", "")
        mac = hmac.new(secret.encode(), request.data, hashlib.sha256)
        expected = "sha256=" + mac.hexdigest()
        if not hmac.compare_digest(sig, expected):
            abort(401)

    data = request.get_json(silent=True) or {}
    event_type = data.get("type", "unknown")
    payload = data.get("payload", {})
    guild_discord_id = payload.get("guild_id")

    guild = None
    if guild_discord_id:
        guild = Guild.query.filter_by(discord_id=str(guild_discord_id)).first()

    # Store event
    event = BotEvent(
        guild_id=guild.id if guild else None,
        event_type=event_type,
        payload=payload,
    )
    db.session.add(event)

    # Handle specific events
    if event_type == "guild_join":
        _handle_guild_join(payload)
    elif event_type == "guild_leave":
        _handle_guild_leave(payload)
    elif event_type == "mod_action":
        _handle_mod_action(payload, guild)
    elif event_type == "ticket_open":
        _handle_ticket_open(payload, guild)
    elif event_type == "ticket_close":
        _handle_ticket_close(payload, guild)
    elif event_type == "ticket_message":
        _handle_ticket_message(payload, guild)

    db.session.commit()
    return jsonify({"ok": True})


def _handle_guild_join(payload: dict):
    discord_id = str(payload.get("guild_id", ""))
    if not discord_id:
        return
    guild = Guild.query.filter_by(discord_id=discord_id).first()
    is_new = guild is None
    if not guild:
        guild = Guild(
            discord_id=discord_id,
            name=payload.get("name", "Unknown"),
            icon=payload.get("icon"),
            owner_discord_id=str(payload.get("owner_id", "")) or None,
            member_count=payload.get("member_count", 0),
            channel_count=payload.get("channel_count", 0),
        )
        db.session.add(guild)
        db.session.flush()
        guild.settings = GuildSettings(guild_id=guild.id)
        db.session.add(guild.settings)
    else:
        # Update fields from heartbeat without spamming notifications
        guild.name = payload.get("name", guild.name)
        guild.icon = payload.get("icon", guild.icon)
        guild.member_count = payload.get("member_count", guild.member_count)
        guild.channel_count = payload.get("channel_count", guild.channel_count)
        guild.role_count = payload.get("role_count", guild.role_count)
        guild.owner_discord_id = str(payload.get("owner_id", "") or "") or guild.owner_discord_id
        guild.is_active = True

    # Always update last_sync timestamp so the dashboard shows when data was last refreshed.
    guild.last_sync = datetime.now(timezone.utc)

    # Only notify on genuine new guild join, not heartbeat re-syncs
    if is_new:
        _notify_admins(
            "guild_join",
            f"Bot joined {guild.name}",
            f"{payload.get('member_count', 0)} members",
            f"/servers/{guild.id}" if guild.id else "",
            guild_id=guild.id,
        )
        push_live_event(
            "guild_join",
            f"Bot joined {guild.name}",
            body=f"{payload.get('member_count', 0)} members",
            severity="info",
            guild_id=guild.id,
        )


def _handle_guild_leave(payload: dict):
    discord_id = str(payload.get("guild_id", ""))
    guild = Guild.query.filter_by(discord_id=discord_id).first()
    if guild:
        guild.is_active = False
        _notify_admins("guild_leave", f"Bot left {guild.name}", guild_id=guild.id)
        push_live_event(
            "guild_leave",
            f"Bot left {guild.name}",
            severity="warning",
            guild_id=guild.id,
        )


def _handle_mod_action(payload: dict, guild: Guild | None):
    if not guild:
        return
    case_num = ModerationCase.query.filter_by(guild_id=guild.id).count() + 1
    case = ModerationCase(
        guild_id=guild.id,
        case_number=case_num,
        action=payload.get("action", "warn"),
        target_id=str(payload.get("target_id", "")),
        target_name=payload.get("target_name"),
        moderator_id=str(payload.get("moderator_id", "")),
        moderator_name=payload.get("moderator_name"),
        reason=payload.get("reason"),
        duration=payload.get("duration"),
    )
    db.session.add(case)
    action = (payload.get("action") or "action").capitalize()
    target = payload.get("target_name") or payload.get("target_id") or "?"
    push_live_event(
        "mod_action",
        f"{action} – {target}",
        body=f"In {guild.name}" + (f": {payload['reason']}" if payload.get("reason") else ""),
        severity="warning",
        guild_id=guild.id,
    )


def _handle_ticket_open(payload: dict, guild: Guild | None):
    if not guild:
        return
    ticket_num = Ticket.query.filter_by(guild_id=guild.id).count() + 1
    ticket = Ticket(
        guild_id=guild.id,
        ticket_number=ticket_num,
        channel_id=str(payload.get("channel_id", "")),
        opener_id=str(payload.get("opener_id", "")),
        opener_name=payload.get("opener_name"),
        subject=payload.get("subject"),
        priority=payload.get("priority", "normal"),
    )
    db.session.add(ticket)
    opener = payload.get("opener_name") or payload.get("opener_id") or "?"
    push_live_event(
        "ticket_open",
        f"Ticket opened by {opener}",
        body=f"In {guild.name}" + (f" · {payload['subject']}" if payload.get("subject") else ""),
        severity="info",
        guild_id=guild.id,
    )


def _handle_ticket_close(payload: dict, guild: Guild | None):
    if not guild:
        return
    channel_id = str(payload.get("channel_id", ""))
    ticket = Ticket.query.filter_by(guild_id=guild.id, channel_id=channel_id).first()
    if ticket:
        ticket.status = "closed"
        ticket.closed_by = payload.get("closed_by")
        ticket.closed_reason = payload.get("reason")
        ticket.closed_at = datetime.now(timezone.utc)
        closed_by = payload.get("closed_by") or "staff"
        push_live_event(
            "ticket_close",
            f"Ticket closed by {closed_by}",
            body=f"In {guild.name}" + (f": {payload['reason']}" if payload.get("reason") else ""),
            severity="info",
            guild_id=guild.id,
        )


def _handle_ticket_message(payload: dict, guild: Guild | None):
    if not guild:
        return
    channel_id = str(payload.get("channel_id", ""))
    ticket = Ticket.query.filter_by(guild_id=guild.id, channel_id=channel_id).first()
    if ticket:
        msg = TicketMessage(
            ticket_id=ticket.id,
            author_id=str(payload.get("author_id", "")),
            author_name=payload.get("author_name"),
            content=payload.get("content", ""),
            is_staff=payload.get("is_staff", False),
        )
        db.session.add(msg)
        ticket.message_count += 1


# ── Notifications ────────────────────────────────────────────────

@api_bp.get("/notifications")
@login_required
def notifications():
    limit = min(int(request.args.get("limit", 20)), 50)
    notifs = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.desc()).limit(limit).all()
    unread = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({
        "unread": unread,
        "notifications": [n.to_dict() for n in notifs],
    })


@api_bp.get("/notifications/unread-count")
@login_required
def notifications_unread_count():
    """Lightweight endpoint used by the nav badge — no full notification list."""
    unread = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({"unread": unread})


@api_bp.post("/notifications/read-all")
@login_required
def notifications_read_all():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


@api_bp.post("/notifications/clear-duplicates")
@login_required
def notifications_clear_duplicates():
    """Delete duplicate notifications keeping only the oldest per (user, type, guild)."""
    # Keep only the first notification per user+type+guild_id group, delete the rest
    deleted = 0
    seen = {}
    notifs = Notification.query.filter_by(
        user_id=current_user.id
    ).order_by(Notification.created_at.asc()).all()
    to_delete = []
    for n in notifs:
        key = (n.type, n.guild_id, n.title)
        if key in seen:
            to_delete.append(n.id)
        else:
            seen[key] = n.id
    if to_delete:
        Notification.query.filter(
            Notification.id.in_(to_delete),
            Notification.user_id == current_user.id
        ).delete(synchronize_session=False)
        db.session.commit()
        deleted = len(to_delete)
    return jsonify({"ok": True, "deleted": deleted})


@api_bp.post("/notifications/<int:notif_id>/read")
@login_required
def notification_read(notif_id: int):
    notif = db.get_or_404(Notification, notif_id)
    if notif.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    notif.is_read = True
    db.session.commit()
    return jsonify({"ok": True})


# ── Real-time SSE ────────────────────────────────────────────────

@api_bp.get("/events")
@login_required
def sse_events():
    """Server-Sent Events — real-time bot state + notifications."""
    def generate():
        import time
        pubsub = redis_client.pubsub()
        pubsub.subscribe("hub:notifications", "hub:bot_events", "hub:live_events")
        try:
            # Send initial state
            bot = get_bot_state()
            yield f"data: {json.dumps({'type': 'bot_state', 'data': bot})}\n\n"

            deadline = time.time() + 55  # 55s max (before proxy timeout)
            while time.time() < deadline:
                msg = pubsub.get_message(timeout=1)
                if msg and msg["type"] == "message":
                    yield f"data: {msg['data']}\n\n"
                else:
                    # Heartbeat every 5s
                    yield f"data: {json.dumps({'type': 'ping'})}\n\n"
                time.sleep(4)
        finally:
            pubsub.unsubscribe()
            pubsub.close()

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Users (admin) ────────────────────────────────────────────────

@api_bp.get("/users")
@login_required
@admin_required
def users():
    qs = User.query.order_by(User.username).all()
    return jsonify([{
        "id": u.id,
        "username": u.username,
        "discord_id": u.discord_id,
        "avatar": u.avatar_url(32),
        "is_owner": u.is_owner,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat(),
        "last_login": u.last_login.isoformat() if u.last_login else None,
    } for u in qs])


@api_bp.patch("/users/<int:user_id>")
@login_required
@admin_required
def user_update(user_id: int):
    user = db.get_or_404(User, user_id)
    data = request.get_json() or {}

    if user.is_owner and not current_user.is_owner:
        return jsonify({"error": "Dashboard owner accounts can only be edited by another owner"}), 403

    if "is_owner" in data:
        if not current_user.is_owner:
            return jsonify({"error": "Only dashboard owners can change owner status"}), 403
        user.is_owner = bool(data["is_owner"])

    if "is_admin" in data:
        user.is_admin = bool(data["is_admin"])
    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    if user.is_owner:
        user.is_admin = True
        user.is_active = True

    db.session.commit()
    _audit("user_update", target_type="user", target_id=str(user_id), details=data)
    return jsonify({"ok": True, "is_owner": user.is_owner, "is_admin": user.is_admin, "is_active": user.is_active})


@api_bp.delete("/users/<int:user_id>")
@login_required
@admin_required
def user_delete(user_id: int):
    """Permanently delete a hub user account (admin only, cannot delete owners)."""
    user = db.get_or_404(User, user_id)
    if user.is_owner:
        return jsonify({"error": "Cannot delete an owner account"}), 403
    if user.id == current_user.id:
        return jsonify({"error": "Cannot delete your own account"}), 403
    _audit("user_delete", target_type="user", target_id=str(user_id), details={"username": user.username})
    db.session.delete(user)
    db.session.commit()
    return jsonify({"ok": True})


# ── Audit log ────────────────────────────────────────────────────

@api_bp.get("/audit")
@login_required
@admin_required
def audit():
    limit = min(int(request.args.get("limit", 50)), 200)
    guild_filter = request.args.get("guild_id")
    q = AuditLog.query
    if guild_filter:
        q = q.filter_by(guild_id=int(guild_filter))
    logs = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return jsonify([entry.to_dict() for entry in logs])


# ── Legacy admin actions ─────────────────────────────────────────

@api_bp.post("/actions/<string:action>")
@login_required
@admin_required
def admin_action(action: str):
    allowed = {"sync_guilds", "clear_cache", "reload_config"}
    if action not in allowed:
        return jsonify({"error": f"Unknown action: {action}"}), 400
    push_bot_command(action)
    _audit(f"admin_action:{action}")
    return jsonify({"ok": True, "action": action})


# ── Admin guild sync (trigger bot to re-emit all guild_join events) ──────────

@api_bp.post("/admin/sync-guilds")
@login_required
@admin_required
def admin_sync_guilds():
    """Trigger a guild sync via the bot's internal HTTP endpoint.

    Requires ``BOT_INTERNAL_URL`` env var pointing at the bot service (e.g.
    ``https://bot-service.up.railway.app``).  The call is authenticated with
    ``BOT_INTERNAL_API_KEY`` / ``WEBHOOK_SECRET``.

    Falls back to reading from Redis bot state when the bot URL is not set.
    """
    import requests as _req  # local import keeps startup fast

    bot_url = os.environ.get("BOT_INTERNAL_URL", "").rstrip("/")
    api_key = os.environ.get("BOT_INTERNAL_API_KEY") or os.environ.get("WEBHOOK_SECRET", "")

    if bot_url:
        try:
            resp = _req.post(
                f"{bot_url}/internal/sync-guilds",
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
            _audit("admin_sync_guilds", details={"via": "bot_internal_api", "guilds": data.get("guilds")})
            return jsonify({"ok": True, "guilds": data.get("guilds", 0),
                            "message": "Bot is syncing guilds to hub now. Refresh in a few seconds."})
        except Exception as exc:  # noqa: BLE001
            current_app.logger.error("admin_sync_guilds: bot call failed: %s", exc)
            return jsonify({"ok": False, "message": f"Bot sync failed: {exc}"}), 502

    # Fallback: try to sync from Redis bot state
    from dashboard.services.bot_state import get_bot_state

    bot_state = get_bot_state()
    raw_guilds = bot_state.get("guilds", [])

    if not raw_guilds:
        return jsonify({
            "ok": False,
            "message": (
                "BOT_INTERNAL_URL is not set and no guilds found in bot state. "
                "Set BOT_INTERNAL_URL on the hub service pointing to the bot, "
                "or redeploy the bot — it will auto-sync guilds on startup."
            ),
            "synced": 0,
        }), 422

    synced = 0
    for g in raw_guilds:
        try:
            _handle_guild_join({
                "guild_id": g.get("id"),
                "name": g.get("name", "Unknown"),
                "icon": g.get("icon"),
                "owner_id": g.get("owner_id") or g.get("ownerId"),
                "member_count": g.get("member_count") or g.get("memberCount", 0),
                "channel_count": g.get("channel_count") or g.get("channelCount", 0),
            })
            synced += 1
        except Exception as exc:  # noqa: BLE001
            current_app.logger.warning("admin_sync_guilds: failed to sync guild %s: %s", g.get("id"), exc)

    db.session.commit()
    _audit("admin_sync_guilds", details={"via": "redis_state", "synced": synced, "total": len(raw_guilds)})
    return jsonify({"ok": True, "synced": synced, "total": len(raw_guilds)})


# ── Phase 16: Ticket priority ─────────────────────────────────────────────────

@api_bp.route("/tickets/<int:ticket_id>/priority", methods=["PATCH"])
@login_required
def ticket_set_priority(ticket_id: int):
    """Update the priority of a ticket (low / normal / high / urgent)."""
    ticket = db.get_or_404(Ticket, ticket_id)
    guild = db.session.get(Guild, ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403
    data = request.get_json(silent=True) or {}
    priority = str(data.get("priority", "")).strip().lower()
    if priority not in {"low", "normal", "high", "urgent"}:
        return jsonify({"error": "Invalid priority. Use: low, normal, high, urgent"}), 400
    ticket.priority = priority
    ticket.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    _audit(
        "ticket_priority_update",
        guild_id=ticket.guild_id,
        target_type="ticket",
        target_id=str(ticket_id),
        details={"priority": priority},
    )
    return jsonify({"ok": True, "priority": ticket.priority})


# ── Phase 17: Notification delete ─────────────────────────────────────────────

@api_bp.route("/notifications/<int:notif_id>", methods=["DELETE"])
@login_required
def notification_delete(notif_id: int):
    """Delete a single notification belonging to the current user."""
    notif = db.get_or_404(Notification, notif_id)
    if notif.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(notif)
    db.session.commit()
    return jsonify({"ok": True})


# ── Phase 18: Tickets bulk close / assign ────────────────────────────────────

@api_bp.post("/guilds/<int:guild_id>/tickets/bulk")
@login_required
@guild_access_required
def guild_tickets_bulk(guild_id: int):
    """Bulk-close or bulk-assign tickets within a guild."""
    data = request.get_json(silent=True) or {}
    action = str(data.get("action", "")).strip().lower()
    raw_ids = data.get("ticket_ids") or []
    try:
        ticket_ids = [int(i) for i in raw_ids]
    except (ValueError, TypeError):
        return jsonify({"error": "ticket_ids must be a list of integers"}), 400

    if action not in {"close", "assign"}:
        return jsonify({"error": "action must be 'close' or 'assign'"}), 400
    if not ticket_ids:
        return jsonify({"error": "ticket_ids is required"}), 400
    if len(ticket_ids) > 100:
        return jsonify({"error": "Cannot bulk-update more than 100 tickets at once"}), 400

    tickets = Ticket.query.filter(
        Ticket.id.in_(ticket_ids),
        Ticket.guild_id == guild_id,
    ).all()

    now = datetime.now(timezone.utc)
    assigned_to = str(data.get("assigned_to") or "").strip() or None
    updated = 0
    for ticket in tickets:
        if action == "close":
            ticket.status = "closed"
            ticket.closed_by = current_user.username
            ticket.closed_at = now
            ticket.updated_at = now
        else:  # assign
            ticket.assigned_to = assigned_to
            ticket.updated_at = now
        updated += 1

    db.session.commit()
    _audit(
        f"ticket_bulk_{action}",
        guild_id=guild_id,
        details={"count": updated, "ticket_ids": ticket_ids},
    )
    return jsonify({"ok": True, "updated": updated})


# ── Phase 19: Moderation case reason / notes update ──────────────────────────

@api_bp.route("/guilds/<int:guild_id>/moderation/<int:case_id>", methods=["PATCH"])
@login_required
@guild_access_required
def guild_moderation_case_update(guild_id: int, case_id: int):
    """Update the reason or notes on a moderation case."""
    case = ModerationCase.query.filter_by(id=case_id, guild_id=guild_id).first_or_404()
    data = request.get_json(silent=True) or {}
    if "reason" in data:
        case.reason = str(data["reason"]).strip() or None
    db.session.commit()
    _audit(
        "mod_case_update",
        guild_id=guild_id,
        target_type="mod_case",
        target_id=str(case_id),
        details={"reason": case.reason},
    )
    return jsonify({"ok": True, "id": case.id, "reason": case.reason})

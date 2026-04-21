"""
REST API — full bot management API.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
from datetime import datetime, timezone
from functools import wraps

import requests
from sqlalchemy import or_

from flask import Blueprint, abort, jsonify, request, stream_with_context, Response
from flask_login import current_user, login_required

from dashboard.extensions import db, redis_client
from dashboard.models import (
    AIActionProposal,
    AIConversationMessage,
    AIConversationThread,
    AuditLog, BotEvent, Guild, GuildCommand, GuildMember,
    GuildSettings, ModerationCase, Notification, Ticket, TicketMessage, User,
)
from dashboard.services.bot_state import get_bot_state, push_bot_command
from dashboard.services.dissident_api import call_dissident_api
from dashboard.versioning import get_dashboard_commit, get_dashboard_version

api_bp = Blueprint("api", __name__)


# ── Helpers ──────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated


def guild_access_required(f):
    """Decorator: user must be admin or have access to the guild."""
    @wraps(f)
    def decorated(*args, **kwargs):
        guild_id = kwargs.get("guild_id") or request.view_args.get("guild_id")
        if guild_id:
            guild = Guild.query.get(guild_id)
            if guild and not current_user.can_manage(guild):
                return jsonify({"error": "Forbidden"}), 403
        return f(*args, **kwargs)
    return decorated


def _audit(action: str, guild_id: int | None = None, target_type: str | None = None,
           target_id: str | None = None, details: dict | None = None,
           actor_id: int | None = None):
    entry = AuditLog(
        action=action,
        actor_id=actor_id if actor_id is not None else (current_user.id if current_user.is_authenticated else None),
        guild_id=guild_id,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.remote_addr,
    )
    db.session.add(entry)
    db.session.commit()


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
    try:
        redis_client.publish("hub:notifications", json.dumps({
            "type": type_, "title": title, "body": body, "link": link
        }))
    except Exception:
        pass


def _bot_internal_api_key() -> str:
    return (
        (os.environ.get("BOT_INTERNAL_API_KEY") or "").strip()
        or (os.environ.get("DISSIDENT_BOT_API_KEY") or "").strip()
    )


def bot_internal_auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        configured = _bot_internal_api_key()
        if not configured:
            return jsonify({"error": "BOT_INTERNAL_API_KEY is not configured"}), 503

        presented = (request.headers.get("X-Bot-Api-Key") or "").strip()
        if not presented or not hmac.compare_digest(presented, configured):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated


def _get_or_create_discord_shadow_user(discord_user_id: str | int | None, username: str | None = None) -> User:
    discord_id = str(discord_user_id or "").strip()
    if not discord_id:
        raise ValueError("discord_user_id is required")

    user = User.query.filter_by(discord_id=discord_id).first()
    if user:
        return user

    base_username = f"discord_{discord_id}"
    candidate = base_username
    suffix = 1
    while User.query.filter_by(username=candidate).first():
        suffix += 1
        candidate = f"{base_username}_{suffix}"

    user = User(
        discord_id=discord_id,
        username=candidate,
        is_admin=False,
        is_active=True,
    )
    db.session.add(user)
    db.session.flush()
    return user


def _record_moderation_case(guild: Guild, *, action: str, target_id: str,
                            target_name: str | None = None, reason: str | None = None,
                            moderator_id: str | None = None, moderator_name: str | None = None,
                            duration: str | None = None) -> ModerationCase:
    case = ModerationCase(
        guild_id=guild.id,
        case_number=guild.mod_cases.count() + 1,
        action=action,
        target_id=str(target_id),
        target_name=target_name,
        moderator_id=moderator_id,
        moderator_name=moderator_name,
        reason=reason,
        duration=duration,
        is_active=action not in {"unban", "unmute", "global_unban"},
    )
    db.session.add(case)
    return case


TICKET_STATUSES = {"open", "resolved", "closed"}


def _set_ticket_status(ticket: Ticket, status: str, actor_name: str | None, reason: str | None = None):
    now = datetime.now(timezone.utc)
    ticket.status = status

    if status == "closed":
        ticket.closed_at = now
        if actor_name:
            ticket.closed_by = actor_name
        if reason:
            ticket.closed_reason = reason
    else:
        ticket.closed_at = None
        ticket.closed_by = None
        if status == "open":
            ticket.closed_reason = None


# ── Health ───────────────────────────────────────────────────────

@api_bp.get("/ping")
def ping():
    return jsonify({"ok": True, "ts": datetime.now(timezone.utc).isoformat()})


@api_bp.get("/version")
def version_info():
    bot = get_bot_state()
    return jsonify(
        {
            "service": "dissident-central-hub",
            "dashboard_version": get_dashboard_version(),
            "dashboard_commit": get_dashboard_commit(),
            "bot_version": bot.get("version", "unknown"),
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )


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
    allowed = {"sync_guilds", "clear_cache", "reload_config", "restart_cog", "reload_cog"}
    if command not in allowed:
        return jsonify({"error": f"unknown command: {command}"}), 400
    push_bot_command(command, data.get("payload", {}))
    _audit(f"bot_command:{command}", details=data.get("payload"))
    return jsonify({"ok": True, "command": command})


@api_bp.get("/bot/invite")
@login_required
def bot_invite():
    client_id = os.environ.get("DISCORD_CLIENT_ID", "")
    perms = 8  # Administrator — or use fine-grained: 1374389534902
    url = f"https://discord.com/oauth2/authorize?client_id={client_id}&permissions={perms}&scope=bot%20applications.commands"
    return jsonify({"url": url, "client_id": client_id})


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
    guild = Guild.query.get_or_404(guild_id)
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
        "ticket_category": s.ticket_category,
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
    guild = Guild.query.get_or_404(guild_id)
    return jsonify(_settings_dict(guild.settings or GuildSettings()))


@api_bp.patch("/guilds/<int:guild_id>/settings")
@login_required
@guild_access_required
def guild_settings_update(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    data = request.get_json() or {}

    if not guild.settings:
        guild.settings = GuildSettings(guild_id=guild.id)
        db.session.add(guild.settings)

    allowed = {
        "prefix", "language", "timezone", "mod_log_channel", "automod_enabled",
        "antinuke_enabled", "max_warns", "warn_action", "welcome_channel",
        "welcome_message", "farewell_channel", "ticket_channel", "ticket_category", "ticket_role",
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
    Guild.query.get_or_404(guild_id)
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
@guild_access_required
def guild_command_update(guild_id: int, cmd_name: str):
    guild = Guild.query.get_or_404(guild_id)
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
    Guild.query.get_or_404(guild_id)
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
    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "cases": [c.to_dict() for c in cases.items],
    })


@api_bp.get("/guilds/<int:guild_id>/moderation/member-search")
@login_required
@guild_access_required
def guild_member_search(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    query = (request.args.get("query") or "").strip()
    if not query:
        return jsonify([])

    status, payload = call_dissident_api(
        "GET",
        f"guilds/{guild.discord_id}/members/search",
        current_user,
        params={"query": query, "limit": request.args.get("limit", 10)},
    )
    return jsonify(payload), status


@api_bp.post("/guilds/<int:guild_id>/moderation/actions")
@login_required
@guild_access_required
def guild_moderation_action(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    data = request.get_json() or {}
    action = str(data.get("action") or "").strip().lower()
    supported = {"ban", "kick", "mute", "unmute", "warn", "unban"}
    if action not in supported:
        return jsonify({"error": "Unsupported moderation action"}), 400

    payload = {
        "guildId": guild.discord_id,
        "userId": data.get("user_id"),
        "reason": data.get("reason"),
    }
    if action == "mute":
        payload["duration"] = data.get("duration")
    if action == "ban":
        payload["deleteMessages"] = bool(data.get("delete_messages"))

    status, response = call_dissident_api(
        "POST",
        f"moderation/{action}",
        current_user,
        json_payload=payload,
    )
    if status >= 400:
        return jsonify(response), status

    _record_moderation_case(
        guild,
        action=action,
        target_id=str(data.get("user_id") or ""),
        target_name=data.get("target_name"),
        reason=data.get("reason"),
        moderator_id=current_user.discord_id,
        moderator_name=current_user.username,
        duration=str(data.get("duration")) if data.get("duration") else None,
    )
    db.session.commit()
    _audit(f"moderation_action:{action}", guild_id=guild.id, target_type="discord_user", target_id=str(data.get("user_id") or ""))
    return jsonify(response)


@api_bp.post("/guilds/<int:guild_id>/moderation/bulk")
@login_required
@guild_access_required
def guild_moderation_bulk(guild_id: int):
    guild = Guild.query.get_or_404(guild_id)
    data = request.get_json() or {}
    action = str(data.get("action") or "").strip().lower()

    status, response = call_dissident_api(
        "POST",
        "moderation/bulk",
        current_user,
        json_payload={
            "guildId": guild.discord_id,
            "action": action,
            "userIds": data.get("user_ids"),
            "reason": data.get("reason"),
            "duration": data.get("duration"),
            "deleteMessages": bool(data.get("delete_messages")),
        },
    )
    if status >= 400:
        return jsonify(response), status

    for result in response.get("results", []):
        if not result.get("success"):
            continue
        _record_moderation_case(
            guild,
            action=action,
            target_id=str(result.get("userId") or ""),
            target_name=result.get("targetTag"),
            reason=data.get("reason"),
            moderator_id=current_user.discord_id,
            moderator_name=current_user.username,
            duration=str(data.get("duration")) if data.get("duration") else None,
        )

    db.session.commit()
    _audit("moderation_bulk", guild_id=guild.id, target_type="guild", target_id=str(guild.id), details={"action": action})
    return jsonify(response)


@api_bp.get("/moderation/global-bans")
@login_required
@admin_required
def global_bans_list():
    status, response = call_dissident_api("GET", "moderation/global-bans", current_user)
    return jsonify(response), status


@api_bp.post("/moderation/global-bans")
@login_required
@admin_required
def global_bans_create():
    data = request.get_json() or {}
    source_guild = None
    if data.get("source_guild_id"):
        source_guild = Guild.query.get(int(data["source_guild_id"]))

    status, response = call_dissident_api(
        "POST",
        "moderation/global-ban",
        current_user,
        json_payload={
            "userId": data.get("user_id"),
            "username": data.get("username"),
            "reason": data.get("reason"),
            "evidence": data.get("evidence"),
            "sourceGuildId": source_guild.discord_id if source_guild else None,
            "deleteMessages": bool(data.get("delete_messages")),
        },
    )
    if status >= 400:
        return jsonify(response), status

    if source_guild:
        _record_moderation_case(
            source_guild,
            action="global_ban",
            target_id=str(data.get("user_id") or ""),
            target_name=data.get("username"),
            reason=data.get("reason"),
            moderator_id=current_user.discord_id,
            moderator_name=current_user.username,
        )
        db.session.commit()

    _audit("global_ban_create", guild_id=source_guild.id if source_guild else None, target_type="discord_user", target_id=str(data.get("user_id") or ""))
    return jsonify(response)


@api_bp.delete("/moderation/global-bans/<string:user_id>")
@login_required
@admin_required
def global_bans_delete(user_id: str):
    data = request.get_json(silent=True) or {}
    status, response = call_dissident_api(
        "DELETE",
        f"moderation/global-ban/{user_id}",
        current_user,
        json_payload={"reason": data.get("reason")},
    )
    _audit("global_ban_delete", target_type="discord_user", target_id=user_id, details={"status": status})
    return jsonify(response), status


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
    Guild.query.get_or_404(guild_id)
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 25)), 100)
    status = request.args.get("status")
    assigned = request.args.get("assigned")

    q = Ticket.query.filter_by(guild_id=guild_id)
    if status:
        q = q.filter_by(status=status)
    if assigned == "unassigned":
        q = q.filter(Ticket.assigned_to.is_(None))
    elif assigned == "assigned":
        q = q.filter(Ticket.assigned_to.is_not(None))

    total = q.count()
    tickets = q.order_by(Ticket.updated_at.desc(), Ticket.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "total": total,
        "tickets": [t.to_dict() for t in tickets.items],
    })


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


@api_bp.get("/tickets/<int:ticket_id>/messages")
@login_required
def ticket_messages(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
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




@api_bp.post("/tickets/<int:ticket_id>/close")
@login_required
def ticket_close(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403
    _set_ticket_status(ticket, "closed", current_user.username)
    db.session.commit()
    _audit("ticket_close", guild_id=ticket.guild_id, target_type="ticket", target_id=str(ticket_id))
    return jsonify({"ok": True})


@api_bp.post("/tickets/<int:ticket_id>/status")
@login_required
def ticket_set_status(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).strip().lower()
    reason = (data.get("reason") or "").strip() or None
    if status not in TICKET_STATUSES:
        return jsonify({"error": "status must be one of: open, resolved, closed"}), 400

    _set_ticket_status(ticket, status, current_user.username, reason)
    db.session.commit()
    _audit(
        "ticket_status_update",
        guild_id=ticket.guild_id,
        target_type="ticket",
        target_id=str(ticket_id),
        details={"status": status, "reason": reason},
    )
    return jsonify({"ok": True, "ticket": ticket.to_dict()})


@api_bp.post("/tickets/<int:ticket_id>/assign")
@login_required
def ticket_assign(ticket_id: int):
    ticket = Ticket.query.get_or_404(ticket_id)
    guild = Guild.query.get(ticket.guild_id)
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    assigned_to = (data.get("assigned_to") or "").strip()
    ticket.assigned_to = assigned_to or None
    db.session.commit()
    _audit(
        "ticket_assignment_update",
        guild_id=ticket.guild_id,
        target_type="ticket",
        target_id=str(ticket_id),
        details={"assigned_to": ticket.assigned_to},
    )
    return jsonify({"ok": True, "ticket": ticket.to_dict()})

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
        guild.owner_discord_id = str(payload.get("owner_id", "") or "") or guild.owner_discord_id
        guild.is_active = True

    # Only notify on genuine new guild join, not heartbeat re-syncs
    if is_new:
        _notify_admins(
            "guild_join",
            f"Bot joined {guild.name}",
            f"{payload.get('member_count', 0)} members",
            f"/servers/{guild.id}" if guild.id else "",
            guild_id=guild.id,
        )


def _handle_guild_leave(payload: dict):
    discord_id = str(payload.get("guild_id", ""))
    guild = Guild.query.filter_by(discord_id=discord_id).first()
    if guild:
        guild.is_active = False
        _notify_admins("guild_leave", f"Bot left {guild.name}", guild_id=guild.id)


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


def _handle_ticket_open(payload: dict, guild: Guild | None):
    if not guild:
        return
    channel_id = str(payload.get("channel_id", ""))
    if not channel_id:
        return

    ticket = Ticket.query.filter_by(guild_id=guild.id, channel_id=channel_id).first()
    if not ticket:
        ticket_num = Ticket.query.filter_by(guild_id=guild.id).count() + 1
        ticket = Ticket(
            guild_id=guild.id,
            ticket_number=ticket_num,
            channel_id=channel_id,
            opener_id=str(payload.get("opener_id", "")),
            opener_name=payload.get("opener_name"),
            subject=payload.get("subject"),
            priority=payload.get("priority", "normal"),
        )
        db.session.add(ticket)
    else:
        ticket.opener_id = str(payload.get("opener_id", ticket.opener_id))
        ticket.opener_name = payload.get("opener_name") or ticket.opener_name
        ticket.subject = payload.get("subject") or ticket.subject
        ticket.priority = payload.get("priority", ticket.priority)
        ticket.status = "open"


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
    notif = Notification.query.get_or_404(notif_id)
    if notif.user_id != current_user.id:
        return jsonify({"error": "Forbidden"}), 403
    notif.is_read = True
    db.session.commit()
    return jsonify({"ok": True})


# ── AI operator ──────────────────────────────────────────────────

AI_CONTEXT_WINDOW = 20
AI_SUMMARY_TRIGGER = 30
AI_OPERATOR_RECENT_CASES = 10
AI_OPERATOR_OPEN_TICKETS = 8
AI_OPERATOR_COMMAND_LIMIT = 30
AI_ALLOWED_SETTING_KEYS = {
    "prefix", "language", "timezone", "mod_log_channel", "automod_enabled",
    "antinuke_enabled", "max_warns", "warn_action", "welcome_channel",
    "welcome_message", "farewell_channel", "ticket_channel", "ticket_category", "ticket_role",
    "leveling_enabled", "level_channel", "xp_multiplier", "log_channel",
    "log_joins", "log_leaves", "log_moderation", "log_messages",
}
AI_ALLOWED_BOT_COMMANDS = {"sync_guilds", "reload_config", "clear_cache", "reload_cog", "restart_cog"}
AI_ALLOWED_COMMAND_UPDATE_KEYS = {"is_enabled", "cooldown_seconds", "response_text"}
AI_ALLOWED_MODERATION_ACTIONS = {"ban", "kick", "mute", "unban", "unmute", "warn"}


def _thread_access_check(thread: AIConversationThread) -> bool:
    if current_user.is_admin:
        return True
    if thread.user_id == current_user.id:
        return True
    if thread.guild_id and thread.guild:
        return current_user.can_manage(thread.guild)
    return False


def _title_from_message(message: str) -> str:
    raw = " ".join(message.split())[:80].strip()
    return raw if raw else "New AI Conversation"


def _build_curated_research_notes() -> list[dict]:
    curated = [
        {
            "title": "Discord server onboarding",
            "summary": "Use a clear welcome channel, server rules, role-selection, and a short getting-started checklist.",
            "url": "https://discord.com/safety",
        },
        {
            "title": "Moderation and trust",
            "summary": "Define staff roles, escalation paths, automod baselines, and transparent enforcement policies.",
            "url": "https://discord.com/moderation",
        },
        {
            "title": "Community structure",
            "summary": "Keep channel taxonomy simple, separate announcements/support/social, and avoid too many hidden channels.",
            "url": "https://discord.com/community",
        },
        {
            "title": "Support and ticket flow",
            "summary": "Set ticket intake templates, SLAs, and clear ticket states (open/resolved/closed).",
            "url": "https://support.discord.com",
        },
    ]
    return curated


def _compute_guild_health(
    recent_cases: list,
    open_tickets: list,
    command_rows: list,
    settings: dict,
) -> tuple[int, list[str]]:
    """Return a rough health score (0-100) and a list of anomaly strings."""
    score = 100
    anomalies: list[str] = []

    punitive = [c for c in recent_cases if c.action in ("ban", "kick", "mute", "warn")]
    if len(punitive) >= 6:
        score -= 25
        anomalies.append(f"moderation_spike: {len(punitive)} punitive actions in recent cases")
    elif len(punitive) >= 3:
        score -= 10
        anomalies.append(f"elevated_moderation: {len(punitive)} punitive actions in recent cases")

    unassigned = sum(1 for t in open_tickets if not t.assigned_to)
    if unassigned >= 4:
        score -= 20
        anomalies.append(f"unassigned_tickets: {unassigned} open tickets have no assignee")
    elif unassigned >= 2:
        score -= 8
        anomalies.append(f"some_unassigned_tickets: {unassigned} open tickets without assignee")

    if not settings:
        score -= 15
        anomalies.append("no_settings: guild has no configured hub settings")
    else:
        critical = {"mod_log_channel", "automod_enabled", "log_channel"}
        missing_critical = critical - set(settings.keys())
        if missing_critical:
            score -= 10
            anomalies.append(f"missing_critical_settings: {', '.join(sorted(missing_critical))}")

    if command_rows:
        disabled = sum(1 for c in command_rows if not c.is_enabled)
        ratio = disabled / len(command_rows)
        if ratio > 0.7:
            score -= 10
            anomalies.append(f"commands_mostly_disabled: {disabled}/{len(command_rows)} commands disabled")

    return max(score, 0), anomalies


def _build_guild_operator_context(guild: Guild | None) -> str:
    if not guild:
        return "No guild context is attached to this thread. Ask clarifying questions before proposing server-specific changes."

    settings = _settings_dict(guild.settings) if guild.settings else {}
    settings = {
        key: value
        for key, value in settings.items()
        if value not in (None, "", [], {}, False)
    }

    recent_cases = guild.mod_cases.order_by(ModerationCase.created_at.desc()).limit(AI_OPERATOR_RECENT_CASES).all()
    open_tickets = guild.tickets.filter_by(status="open").order_by(Ticket.updated_at.desc()).limit(AI_OPERATOR_OPEN_TICKETS).all()
    command_rows = GuildCommand.query.filter_by(guild_id=guild.id).order_by(GuildCommand.command_name.asc()).limit(AI_OPERATOR_COMMAND_LIMIT).all()

    health_score, anomalies = _compute_guild_health(recent_cases, open_tickets, command_rows, settings)
    anomaly_line = " | ".join(anomalies) or "none"

    recent_case_lines = [
        f"#{case.case_number} {case.action} target={case.target_name or case.target_id} reason={case.reason or 'none'} active={case.is_active}"
        for case in recent_cases
    ] or ["none"]

    open_ticket_lines = [
        f"#{ticket.ticket_number} subject={ticket.subject or 'unspecified'} priority={ticket.priority} assigned={ticket.assigned_to or 'unassigned'}"
        for ticket in open_tickets
    ] or ["none"]

    enabled_commands = [cmd.command_name for cmd in command_rows if cmd.is_enabled]
    disabled_commands = [cmd.command_name for cmd in command_rows if not cmd.is_enabled]
    command_summary = (
        f"enabled={len(enabled_commands)} disabled={len(disabled_commands)}"
        + (f" disabled_list={','.join(disabled_commands[:10])}" if disabled_commands else "")
    )

    bot_state = get_bot_state()
    bot_guild = next(
        (item for item in bot_state.get("guilds", []) if str(item.get("id")) == guild.discord_id),
        {},
    )

    return (
        f"Guild profile:\n"
        f"- name: {guild.name}\n"
        f"- discord_id: {guild.discord_id}\n"
        f"- members: {guild.member_count}\n"
        f"- channels: {guild.channel_count}\n"
        f"- roles: {guild.role_count}\n"
        f"- owner_discord_id: {guild.owner_discord_id or 'unknown'}\n"
        f"- bot_joined_at: {guild.bot_joined_at.isoformat() if guild.bot_joined_at else 'unknown'}\n"
        f"- bot_seen_member_count: {bot_guild.get('member_count', guild.member_count)}\n"
        f"- health_score: {health_score}/100\n"
        f"- anomalies: {anomaly_line}\n"
        f"- configured_settings: {json.dumps(settings, ensure_ascii=True)}\n"
        f"- recent_moderation ({len(recent_cases)}): {' | '.join(recent_case_lines)}\n"
        f"- open_tickets ({len(open_tickets)}): {' | '.join(open_ticket_lines)}\n"
        f"- commands: {command_summary}"
    )


def _build_operator_system_prompt(*, mode: str, research_notes: list[dict], guild_context: str, thread_summary: str | None) -> str:
    prompt = (
        "You are Dissident Central Operator, a central-hub-native operations copilot for Discord communities. "
        "Think like a senior operator, community architect, and safety-minded automation planner. "
        "Your responses must be grounded in the actual Central Hub state when guild context is supplied. "
        "Do not behave like a rigid questionnaire or generic chatbot. Diagnose the current state, identify leverage, and recommend the smallest effective next move. "
        "Prefer concrete, rollout-safe plans with rationale, risks, and validation steps."
    )

    if mode == "incident":
        prompt += (
            " INCIDENT MODE: An active incident is in progress. Skip all discovery questions. "
            "Immediately triage: (1) identify scope and severity, (2) propose containment actions, "
            "(3) draft a calm member-facing communication, (4) outline post-incident steps. "
            "Be direct, fast, and decisive. Every second counts."
        )
    elif mode == "interview":
        prompt += (
            " In interview mode, drive discovery adaptively. Ask only the most valuable next question, based on what is still missing, and keep momentum high."
        )
    else:
        prompt += " In ask mode, answer decisively and use the supplied hub context before asking follow-up questions."

    prompt += (
        " You can propose Central Hub actions, but you must never imply they already executed. "
        "When a change is directly actionable through the hub, append an XML block exactly like "
        '<ACTION_PROPOSALS>{"proposals":[{"action_type":"update_guild_settings","payload":{...},"rationale":"..."}]}</ACTION_PROPOSALS>. '
        "Supported action types: update_guild_settings, update_command, moderation_action, bot_command, create_ticket, close_ticket."
    )

    if thread_summary:
        prompt += f"\n\nConversation continuity:\n{thread_summary.strip()}"

    if guild_context:
        prompt += f"\n\nCentral Hub context:\n{guild_context.strip()}"

    research_block = "\n".join(
        f"- {note.get('title')}: {note.get('summary')} (source: {note.get('url')})"
        for note in research_notes
    )
    if research_block:
        prompt += f"\n\nResearch notes:\n{research_block}"

    return prompt


def _build_live_research_notes(query: str) -> list[dict]:
    notes = []
    try:
        params = {
            "q": f"best discord server setup practices {query}",
            "format": "json",
            "no_redirect": "1",
            "no_html": "1",
            "skip_disambig": "1",
        }
        resp = requests.get("https://api.duckduckgo.com/", params=params, timeout=12)
        if resp.status_code >= 400:
            return notes
        payload = resp.json()

        abstract = (payload.get("AbstractText") or "").strip()
        abstract_url = (payload.get("AbstractURL") or "").strip()
        if abstract:
            notes.append({
                "title": payload.get("Heading") or "DuckDuckGo abstract",
                "summary": abstract,
                "url": abstract_url or "https://duckduckgo.com/",
            })

        related = payload.get("RelatedTopics") or []
        for item in related:
            if len(notes) >= 5:
                break
            if "Text" in item and "FirstURL" in item:
                notes.append({
                    "title": item.get("Text", "").split(" - ")[0][:120],
                    "summary": item.get("Text", "")[:280],
                    "url": item.get("FirstURL", "https://duckduckgo.com/"),
                })
            topics = item.get("Topics") if isinstance(item, dict) else None
            if topics:
                for sub in topics:
                    if len(notes) >= 5:
                        break
                    if "Text" in sub and "FirstURL" in sub:
                        notes.append({
                            "title": sub.get("Text", "").split(" - ")[0][:120],
                            "summary": sub.get("Text", "")[:280],
                            "url": sub.get("FirstURL", "https://duckduckgo.com/"),
                        })
    except Exception:
        return []
    return notes


def _maybe_refresh_thread_summary(thread: AIConversationThread):
    if thread.message_count < AI_SUMMARY_TRIGGER:
        return
    # Build a structured continuity summary: user goals + key operator advice.
    all_msgs = thread.messages.order_by(AIConversationMessage.created_at.asc()).limit(40).all()

    user_lines = [
        f"  - {m.content[:150].strip()}"
        for m in all_msgs
        if m.role == "user"
    ][:6]

    # Extract assistant advice: prefer sentences containing action verbs
    action_keywords = ("enable", "disable", "set", "configure", "add", "remove", "ban", "kick", "create", "close", "update", "check", "audit", "fix", "recommend")
    assistant_lines = []
    for m in all_msgs:
        if m.role != "assistant":
            continue
        first_sentence = (m.content.split(". ")[0] or m.content)[:160].strip()
        if any(kw in first_sentence.lower() for kw in action_keywords):
            assistant_lines.append(f"  - {first_sentence}")
    # Fall back to last 4 assistant messages if none matched action keywords
    if not assistant_lines:
        assistant_lines = [
            f"  - {m.content[:160].strip()}"
            for m in all_msgs
            if m.role == "assistant"
        ][-4:]
    else:
        assistant_lines = assistant_lines[-5:]

    lines = ["User requests so far:"] + (user_lines or ["  - (none)"])
    lines += ["Key operator guidance:"] + (assistant_lines or ["  - (none)"])
    thread.summary = "\n".join(lines)


def _extract_action_proposals(content: str) -> tuple[str, list[dict]]:
    proposals: list[dict] = []
    match = re.search(r"<ACTION_PROPOSALS>(.*?)</ACTION_PROPOSALS>", content, flags=re.DOTALL | re.IGNORECASE)
    if not match:
        return content.strip(), proposals

    payload_raw = match.group(1).strip()
    cleaned_content = (content[:match.start()] + content[match.end():]).strip()

    try:
        parsed = json.loads(payload_raw)
        if isinstance(parsed, dict):
            parsed = parsed.get("proposals", [])
        if isinstance(parsed, list):
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                action_type = (item.get("action_type") or "").strip()
                payload = item.get("payload") or {}
                rationale = (item.get("rationale") or "").strip()
                if not action_type:
                    continue
                proposals.append({
                    "action_type": action_type,
                    "payload": payload if isinstance(payload, dict) else {},
                    "rationale": rationale,
                })
    except Exception:
        return content.strip(), []

    return cleaned_content, proposals


def _proposal_is_allowed(action_type: str, payload: dict) -> tuple[bool, str | None]:
    if action_type == "update_guild_settings":
        settings = payload.get("settings")
        if not isinstance(settings, dict):
            return False, "settings must be an object"
        invalid = [k for k in settings.keys() if k not in AI_ALLOWED_SETTING_KEYS]
        if invalid:
            return False, f"unsupported setting keys: {', '.join(invalid)}"
        return True, None

    if action_type == "update_command":
        command_name = (payload.get("command_name") or "").strip()
        if not command_name:
            return False, "command_name is required"
        changes = payload.get("changes")
        if not isinstance(changes, dict):
            return False, "changes must be an object"
        invalid = [key for key in changes.keys() if key not in AI_ALLOWED_COMMAND_UPDATE_KEYS]
        if invalid:
            return False, f"unsupported command update keys: {', '.join(invalid)}"
        if "cooldown_seconds" in changes:
            try:
                int(changes["cooldown_seconds"])
            except (TypeError, ValueError):
                return False, "cooldown_seconds must be an integer"
        return True, None

    if action_type == "moderation_action":
        action = (payload.get("action") or "").strip()
        user_id = str(payload.get("user_id") or "").strip()
        if action not in AI_ALLOWED_MODERATION_ACTIONS:
            return False, f"unsupported moderation action: {action}"
        if not user_id:
            return False, "user_id is required"
        return True, None

    if action_type == "bot_command":
        cmd = (payload.get("command") or "").strip()
        if cmd not in AI_ALLOWED_BOT_COMMANDS:
            return False, f"unsupported bot command: {cmd}"
        return True, None

    if action_type == "create_ticket":
        subject = (payload.get("subject") or "").strip()
        if not subject:
            return False, "subject is required for create_ticket"
        return True, None

    if action_type == "close_ticket":
        ticket_id = payload.get("ticket_id")
        if not ticket_id:
            return False, "ticket_id is required for close_ticket"
        return True, None

    return False, f"unsupported action_type: {action_type}"


def _run_ai_operator_request(
    actor_user: User,
    *,
    message: str,
    mode: str,
    source: str,
    requested_research_mode: str,
    guild: Guild | None,
    thread_id: int | None,
    allow_thread_access,
    allow_guild_access,
    allow_live_research: bool,
    message_metadata: dict | None = None,
) -> tuple[dict, int]:
    if not message:
        return {"error": "message is required"}, 400

    thread = None
    if thread_id:
        thread = AIConversationThread.query.get(thread_id)
        if not thread:
            return {"error": "Thread not found"}, 404
        if not allow_thread_access(thread):
            return {"error": "Forbidden"}, 403
        guild = thread.guild
    else:
        if guild and not allow_guild_access(guild):
            return {"error": "Forbidden"}, 403

        research_mode = requested_research_mode if requested_research_mode in {"curated", "live"} else "curated"
        if research_mode == "live" and not allow_live_research:
            research_mode = "curated"

        thread = AIConversationThread(
            guild_id=guild.id if guild else None,
            user_id=actor_user.id,
            title=_title_from_message(message),
            mode=mode if mode in {"ask", "interview", "incident"} else "ask",
            source=source if source in {"dashboard", "discord"} else "dashboard",
            research_mode=research_mode,
        )
        db.session.add(thread)
        db.session.flush()

    if guild is None and thread.guild_id:
        guild = Guild.query.get(thread.guild_id)

    base_url = (os.environ.get("OLLAMA_BASE_URL") or "").strip().rstrip("/")
    model = (os.environ.get("OLLAMA_MODEL") or "kimi-k2.6:cloud").strip()
    api_key = (os.environ.get("OLLAMA_API_KEY") or "").strip()
    timeout = int((os.environ.get("OLLAMA_TIMEOUT_SECONDS") or "120").strip() or 120)

    if not base_url:
        return {"error": "OLLAMA_BASE_URL is not configured"}, 503

    if thread.research_mode == "live" and not allow_live_research:
        thread.research_mode = "curated"

    if mode in {"ask", "interview", "incident"} and thread.mode != mode:
        thread.mode = mode

    if source in {"dashboard", "discord"} and thread.source != source:
        thread.source = source

    research_notes = _build_curated_research_notes()
    if thread.research_mode == "live":
        live_notes = _build_live_research_notes(message)
        if live_notes:
            research_notes = live_notes

    guild_context = _build_guild_operator_context(guild) if guild and allow_guild_access(guild) else ""
    system_prompt = _build_operator_system_prompt(
        mode=thread.mode,
        research_notes=research_notes,
        guild_context=guild_context,
        thread_summary=thread.summary,
    )
    user_prompt = f"Operator request:\n{message}".strip()

    user_message = AIConversationMessage(
        thread_id=thread.id,
        role="user",
        content=message,
        source=source if source in {"dashboard", "discord"} else "dashboard",
        metadata={
            "guild_id": thread.guild_id,
            "mode": thread.mode,
            **(message_metadata or {}),
        },
    )
    db.session.add(user_message)
    db.session.flush()

    historical_messages = thread.messages.order_by(AIConversationMessage.created_at.desc()).limit(AI_CONTEXT_WINDOW).all()
    historical_messages.reverse()

    llm_messages = [{"role": "system", "content": system_prompt}]
    for historical_message in historical_messages:
        llm_messages.append({"role": historical_message.role, "content": historical_message.content})
    llm_messages.append({"role": "user", "content": user_prompt})

    payload = {
        "model": model,
        "messages": llm_messages,
        "temperature": 0.4,
        "max_tokens": 1200,
    }

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    endpoint = f"{base_url}/chat/completions"
    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        return {"error": f"AI upstream request failed: {exc}"}, 502

    if response.status_code >= 400:
        return {
            "error": f"AI upstream error {response.status_code}",
            "detail": response.text[:500],
        }, 502

    try:
        body = response.json()
    except ValueError:
        return {"error": "AI upstream returned non-JSON response"}, 502

    choices = body.get("choices") or []
    content = ""
    if choices:
        content = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not content:
        content = "No response content returned by AI provider."

    clean_content, extracted_proposals = _extract_action_proposals(content)
    if not clean_content:
        clean_content = "No response content returned by AI provider."

    assistant_message = AIConversationMessage(
        thread_id=thread.id,
        role="assistant",
        content=clean_content,
        source="advisor",
        metadata={
            "model": model,
            "mode": thread.mode,
            "research_mode": thread.research_mode,
            "research_notes": research_notes,
            **(message_metadata or {}),
        },
    )
    db.session.add(assistant_message)
    db.session.flush()

    created_proposals = []
    for proposal_data in extracted_proposals:
        action_type = proposal_data["action_type"]
        proposal_payload = proposal_data.get("payload") or {}
        ok, err = _proposal_is_allowed(action_type, proposal_payload)
        if not ok:
            continue
        proposal = AIActionProposal(
            thread_id=thread.id,
            guild_id=thread.guild_id,
            proposed_by_msg=assistant_message.id,
            action_type=action_type,
            payload=proposal_payload,
            rationale=proposal_data.get("rationale"),
            status="pending",
        )
        db.session.add(proposal)
        db.session.flush()
        created_proposals.append(proposal.to_dict())

    thread.message_count = thread.messages.count()
    thread.updated_at = datetime.now(timezone.utc)
    _maybe_refresh_thread_summary(thread)
    db.session.commit()

    _audit(
        "ai_operator_message",
        guild_id=thread.guild_id,
        target_type="ai_thread",
        target_id=str(thread.id),
        details={
            "mode": thread.mode,
            "research_mode": thread.research_mode,
            "proposals": len(created_proposals),
            "source": thread.source,
        },
        actor_id=actor_user.id,
    )

    return {
        "ok": True,
        "response": clean_content,
        "model": model,
        "mode": thread.mode,
        "thread": thread.to_dict(),
        "assistant_message": assistant_message.to_dict(),
        "research_mode": thread.research_mode,
        "research_notes": research_notes,
        "proposals": created_proposals,
    }, 200


@api_bp.get("/ai/threads")
@login_required
def ai_threads_list():
    guild_id = request.args.get("guild_id", type=int)

    if current_user.is_admin:
        q = AIConversationThread.query
    else:
        q = AIConversationThread.query.filter(
            or_(
                AIConversationThread.user_id == current_user.id,
                AIConversationThread.guild_id.in_([m.guild_id for m in GuildMember.query.filter_by(user_id=current_user.id)]),
            )
        )

    if guild_id:
        q = q.filter_by(guild_id=guild_id)

    threads = q.order_by(AIConversationThread.updated_at.desc()).limit(100).all()
    return jsonify([t.to_dict() for t in threads])


@api_bp.post("/ai/threads")
@login_required
def ai_threads_create():
    data = request.get_json(silent=True) or {}
    guild_id = data.get("guild_id")
    mode = (data.get("mode") or "ask").strip().lower()
    source = (data.get("source") or "dashboard").strip().lower()
    title = (data.get("title") or "").strip()
    research_mode = (data.get("research_mode") or "curated").strip().lower()

    if mode not in {"ask", "interview"}:
        return jsonify({"error": "mode must be ask or interview"}), 400
    if source not in {"dashboard", "discord"}:
        source = "dashboard"
    if research_mode not in {"curated", "live"}:
        research_mode = "curated"

    guild = None
    if guild_id is not None:
        guild = Guild.query.get(guild_id)
        if not guild:
            return jsonify({"error": "Guild not found"}), 404
        if not current_user.can_manage(guild):
            return jsonify({"error": "Forbidden"}), 403

    if research_mode == "live":
        live_enabled = (os.environ.get("AI_LIVE_RESEARCH_ENABLED") or "").strip().lower() in {"1", "true", "yes"}
        if not live_enabled or not current_user.is_admin:
            research_mode = "curated"

    thread = AIConversationThread(
        guild_id=guild.id if guild else None,
        user_id=current_user.id,
        title=title or "New AI Conversation",
        mode=mode,
        source=source,
        research_mode=research_mode,
    )
    db.session.add(thread)
    db.session.commit()
    return jsonify({"ok": True, "thread": thread.to_dict()})


@api_bp.get("/ai/threads/<int:thread_id>/messages")
@login_required
def ai_thread_messages(thread_id: int):
    thread = AIConversationThread.query.get_or_404(thread_id)
    if not _thread_access_check(thread):
        return jsonify({"error": "Forbidden"}), 403

    messages = thread.messages.order_by(AIConversationMessage.created_at.asc()).all()
    return jsonify({
        "thread": thread.to_dict(),
        "messages": [m.to_dict() for m in messages],
    })


@api_bp.get("/ai/threads/<int:thread_id>/proposals")
@login_required
def ai_thread_proposals(thread_id: int):
    thread = AIConversationThread.query.get_or_404(thread_id)
    if not _thread_access_check(thread):
        return jsonify({"error": "Forbidden"}), 403
    proposals = thread.proposals.order_by(AIActionProposal.created_at.desc()).all()
    return jsonify([p.to_dict() for p in proposals])

@api_bp.post("/ai/advisor")
@api_bp.post("/ai/operator")
@login_required
def ai_advisor():
    data = request.get_json() or {}
    guild = None
    guild_id = data.get("guild_id")
    if guild_id is not None:
        guild = Guild.query.get(guild_id)
        if not guild:
            return jsonify({"error": "Guild not found"}), 404

    live_enabled = (os.environ.get("AI_LIVE_RESEARCH_ENABLED") or "").strip().lower() in {"1", "true", "yes"}
    payload, status = _run_ai_operator_request(
        current_user,
        message=(data.get("message") or "").strip(),
        mode=(data.get("mode") or "ask").strip().lower(),
        source=(data.get("source") or "dashboard").strip().lower(),
        requested_research_mode=(data.get("research_mode") or "curated").strip().lower(),
        guild=guild,
        thread_id=data.get("thread_id"),
        allow_thread_access=_thread_access_check,
        allow_guild_access=current_user.can_manage,
        allow_live_research=live_enabled and current_user.is_admin,
    )
    return jsonify(payload), status


@api_bp.post("/internal/ai/discord-advisor")
@api_bp.post("/internal/ai/discord-operator")
@bot_internal_auth_required
def internal_ai_discord_advisor():
    data = request.get_json(silent=True) or {}

    guild = None
    guild_id = data.get("guild_id")
    guild_discord_id = (data.get("guild_discord_id") or "").strip()
    if guild_id is not None:
        guild = Guild.query.get(guild_id)
    elif guild_discord_id:
        guild = Guild.query.filter_by(discord_id=guild_discord_id).first()

    if (guild_id is not None or guild_discord_id) and not guild:
        return jsonify({"error": "Guild not found"}), 404

    try:
        actor_user = _get_or_create_discord_shadow_user(
            data.get("discord_user_id"),
            data.get("discord_username"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    live_enabled = (os.environ.get("AI_LIVE_RESEARCH_ENABLED") or "").strip().lower() in {"1", "true", "yes"}
    payload, status = _run_ai_operator_request(
        actor_user,
        message=(data.get("message") or "").strip(),
        mode=(data.get("mode") or "ask").strip().lower(),
        source="discord",
        requested_research_mode=(data.get("research_mode") or "curated").strip().lower(),
        guild=guild,
        thread_id=data.get("thread_id"),
        allow_thread_access=lambda thread: thread.user_id == actor_user.id or (guild is not None and thread.guild_id == guild.id),
        allow_guild_access=lambda resolved_guild: guild is not None and resolved_guild.id == guild.id,
        allow_live_research=live_enabled,
        message_metadata={
            "discord_user_id": str(data.get("discord_user_id") or ""),
            "discord_username": data.get("discord_username"),
            "channel_id": str(data.get("channel_id") or ""),
        },
    )
    return jsonify(payload), status


@api_bp.post("/ai/proposals/<int:proposal_id>/approve")
@login_required
def ai_approve_proposal(proposal_id: int):
    proposal = AIActionProposal.query.get_or_404(proposal_id)
    thread = proposal.thread
    if not _thread_access_check(thread):
        return jsonify({"error": "Forbidden"}), 403
    if proposal.status not in {"pending", "failed"}:
        return jsonify({"error": f"Proposal is {proposal.status}"}), 400

    guild = Guild.query.get(proposal.guild_id) if proposal.guild_id else None
    if guild and not current_user.can_manage(guild):
        return jsonify({"error": "Forbidden"}), 403

    proposal.status = "approved"
    proposal.approved_by = current_user.id
    proposal.approved_at = datetime.now(timezone.utc)

    try:
        if proposal.action_type == "update_guild_settings":
            if not guild:
                raise ValueError("Guild context is required for settings updates")

            if not guild.settings:
                guild.settings = GuildSettings(guild_id=guild.id)
                db.session.add(guild.settings)

            settings = proposal.payload.get("settings") or {}
            changed = {}
            for key, val in settings.items():
                if key in AI_ALLOWED_SETTING_KEYS and hasattr(guild.settings, key):
                    setattr(guild.settings, key, val)
                    changed[key] = val

            push_bot_command("update_guild_settings", {
                "guild_id": guild.discord_id,
                "settings": changed,
            })

        elif proposal.action_type == "update_command":
            if not guild:
                raise ValueError("Guild context is required for command updates")

            command_name = (proposal.payload.get("command_name") or "").strip()
            changes = proposal.payload.get("changes") if isinstance(proposal.payload.get("changes"), dict) else {}
            if not command_name:
                raise ValueError("command_name is required")

            command_row = GuildCommand.query.filter_by(guild_id=guild.id, command_name=command_name).first()
            if not command_row:
                command_row = GuildCommand(guild_id=guild.id, command_name=command_name)
                db.session.add(command_row)

            if "is_enabled" in changes:
                command_row.is_enabled = bool(changes["is_enabled"])
            if "cooldown_seconds" in changes:
                command_row.cooldown_seconds = int(changes["cooldown_seconds"])

            push_bot_command("update_command", {
                "guild_id": guild.discord_id,
                "command": command_name,
                "enabled": command_row.is_enabled,
                "cooldown": command_row.cooldown_seconds,
            })

        elif proposal.action_type == "moderation_action":
            if not guild:
                raise ValueError("Guild context is required for moderation actions")

            action = (proposal.payload.get("action") or "").strip().lower()
            target_id = str(proposal.payload.get("user_id") or "").strip()
            if action not in AI_ALLOWED_MODERATION_ACTIONS:
                raise ValueError(f"Unsupported moderation action: {action}")
            if not target_id:
                raise ValueError("user_id is required")

            status, response = call_dissident_api(
                "POST",
                f"moderation/{action}",
                current_user,
                json_payload={
                    "guildId": guild.discord_id,
                    "userId": target_id,
                    "reason": proposal.payload.get("reason"),
                    "duration": proposal.payload.get("duration"),
                    "deleteMessages": bool(proposal.payload.get("delete_messages")),
                },
            )
            if status >= 400:
                raise ValueError((response or {}).get("error") or f"moderation API returned {status}")

            _record_moderation_case(
                guild,
                action=action,
                target_id=target_id,
                target_name=proposal.payload.get("target_name"),
                reason=proposal.payload.get("reason"),
                moderator_id=current_user.discord_id,
                moderator_name=current_user.username,
                duration=str(proposal.payload.get("duration")) if proposal.payload.get("duration") else None,
            )

        elif proposal.action_type == "bot_command":
            if not current_user.is_admin:
                raise PermissionError("Admin required to execute bot commands")
            cmd = (proposal.payload.get("command") or "").strip()
            if cmd not in AI_ALLOWED_BOT_COMMANDS:
                raise ValueError(f"Unsupported command: {cmd}")
            payload = proposal.payload.get("payload") if isinstance(proposal.payload.get("payload"), dict) else {}
            push_bot_command(cmd, payload)
        else:
            raise ValueError(f"Unsupported action_type: {proposal.action_type}")

        proposal.status = "executed"
        proposal.executed_at = datetime.now(timezone.utc)
        proposal.error = None
        db.session.commit()

        _audit(
            "ai_proposal_executed",
            guild_id=proposal.guild_id,
            target_type="ai_proposal",
            target_id=str(proposal.id),
            details={"action_type": proposal.action_type},
        )
        return jsonify({"ok": True, "proposal": proposal.to_dict()})
    except Exception as exc:
        proposal.status = "failed"
        proposal.error = str(exc)
        db.session.commit()
        return jsonify({"error": str(exc), "proposal": proposal.to_dict()}), 400


@api_bp.post("/ai/proposals/<int:proposal_id>/reject")
@login_required
def ai_reject_proposal(proposal_id: int):
    proposal = AIActionProposal.query.get_or_404(proposal_id)
    thread = proposal.thread
    if not _thread_access_check(thread):
        return jsonify({"error": "Forbidden"}), 403
    if proposal.status != "pending":
        return jsonify({"error": f"Proposal is {proposal.status}"}), 400

    proposal.status = "rejected"
    proposal.approved_by = current_user.id
    proposal.approved_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"ok": True, "proposal": proposal.to_dict()})


# ── Real-time SSE ────────────────────────────────────────────────

@api_bp.get("/events")
@login_required
def sse_events():
    """Server-Sent Events — real-time bot state + notifications."""
    def generate():
        import time
        pubsub = redis_client.pubsub()
        pubsub.subscribe("hub:notifications", "hub:bot_events")
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
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat(),
        "last_login": u.last_login.isoformat() if u.last_login else None,
    } for u in qs])


@api_bp.patch("/users/<int:user_id>")
@login_required
@admin_required
def user_update(user_id: int):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    if "is_admin" in data:
        user.is_admin = bool(data["is_admin"])
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    db.session.commit()
    _audit("user_update", target_type="user", target_id=str(user_id), details=data)
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

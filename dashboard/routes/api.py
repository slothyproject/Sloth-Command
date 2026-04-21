"""
REST API — full bot management API.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, abort, jsonify, request, stream_with_context, Response
from flask_login import current_user, login_required

from dashboard.extensions import db, redis_client
from dashboard.models import (
    AuditLog, BotEvent, Guild, GuildCommand, GuildMember,
    GuildSettings, ModerationCase, Notification, Ticket, TicketMessage, User,
)
from dashboard.services.bot_state import get_bot_state, push_bot_command
from dashboard.services.dissident_api import call_dissident_api

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


# ── Health ───────────────────────────────────────────────────────

@api_bp.get("/ping")
def ping():
    return jsonify({"ok": True, "ts": datetime.now(timezone.utc).isoformat()})


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

    q = Ticket.query.filter_by(guild_id=guild_id)
    if status:
        q = q.filter_by(status=status)

    total = q.count()
    tickets = q.order_by(Ticket.created_at.desc()).paginate(
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
    from datetime import datetime, timezone
    ticket.status = "closed"
    ticket.closed_by = current_user.username
    ticket.closed_at = datetime.now(timezone.utc)
    db.session.commit()
    _audit("ticket_close", guild_id=ticket.guild_id, target_type="ticket", target_id=str(ticket_id))
    return jsonify({"ok": True})

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

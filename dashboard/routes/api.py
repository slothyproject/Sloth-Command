"""
REST API blueprint — all routes under /api/.
Consumed by the dashboard frontend (AJAX) and optionally external clients.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from dashboard.extensions import db
from dashboard.models import Guild, User, AuditLog
from dashboard.services.bot_state import get_bot_state

api_bp = Blueprint("api", __name__)


# ── Health & status ──────────────────────────────────────────────


@api_bp.get("/ping")
def ping():
    return jsonify({"ok": True})


@api_bp.get("/status")
@login_required
def status():
    bot = get_bot_state()
    return jsonify(
        {
            "bot": bot,
            "hub": {"status": "online", "version": "1.0.0"},
        }
    )


# ── Public (no auth) — homepage widget data ──────────────────────


@api_bp.get("/public/stats")
def public_stats():
    guild_count = Guild.query.filter_by(is_active=True).count()
    bot = get_bot_state()
    return jsonify(
        {
            "guilds": guild_count,
            "bot_online": bot.get("online", False),
            "member_count": bot.get("member_count", 0),
            "command_count": bot.get("command_count", 0),
        }
    )


# ── Bot state ────────────────────────────────────────────────────


@api_bp.get("/bot")
@login_required
def bot_state():
    return jsonify(get_bot_state())


@api_bp.get("/stats")
@login_required
def stats():
    bot = get_bot_state()
    return jsonify(
        {
            "guilds": bot.get("guild_count", 0),
            "members": bot.get("member_count", 0),
            "commands_today": bot.get("commands_today", 0),
            "uptime": bot.get("uptime", "unknown"),
            "latency_ms": bot.get("latency_ms", 0),
        }
    )


# ── Guilds ───────────────────────────────────────────────────────


@api_bp.get("/guilds")
@login_required
def guilds():
    qs = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    return jsonify(
        [
            {
                "id": g.id,
                "discord_id": g.discord_id,
                "name": g.name,
                "icon": g.icon,
                "member_count": g.member_count,
                "last_sync": g.last_sync.isoformat() if g.last_sync else None,
            }
            for g in qs
        ]
    )


@api_bp.get("/guilds/<string:discord_id>")
@login_required
def guild_detail(discord_id: str):
    guild = Guild.query.filter_by(discord_id=discord_id).first_or_404()
    return jsonify(
        {
            "id": guild.id,
            "discord_id": guild.discord_id,
            "name": guild.name,
            "icon": guild.icon,
            "member_count": guild.member_count,
            "joined_at": guild.joined_at.isoformat() if guild.joined_at else None,
            "last_sync": guild.last_sync.isoformat() if guild.last_sync else None,
        }
    )


# ── Users (admin only) ───────────────────────────────────────────


@api_bp.get("/users")
@login_required
def users():
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403
    qs = User.query.order_by(User.username).all()
    return jsonify(
        [
            {
                "id": u.id,
                "username": u.username,
                "discord_id": u.discord_id,
                "is_admin": u.is_admin,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in qs
        ]
    )


# ── Audit log ────────────────────────────────────────────────────


@api_bp.get("/audit")
@login_required
def audit():
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403
    limit = min(int(request.args.get("limit", 50)), 200)
    logs = (
        AuditLog.query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    )
    return jsonify(
        [
            {
                "id": log.id,
                "action": log.action,
                "actor": log.actor.username if log.actor else None,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]
    )


# ── Admin actions ────────────────────────────────────────────────


@api_bp.post("/actions/<string:action>")
@login_required
def admin_action(action: str):
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    allowed = {"sync_guilds", "clear_cache", "reload_config"}
    if action not in allowed:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    # Actions are dispatched via Redis pub/sub to the bot
    from dashboard.extensions import redis_client
    redis_client.publish("hub:actions", action)

    _log_audit(current_user.id, f"admin_action:{action}", request.remote_addr)
    return jsonify({"ok": True, "action": action})


# ── Helpers ──────────────────────────────────────────────────────


def _log_audit(actor_id: int, action: str, ip: str | None) -> None:
    entry = AuditLog(actor_id=actor_id, action=action, ip_address=ip)
    db.session.add(entry)
    db.session.commit()

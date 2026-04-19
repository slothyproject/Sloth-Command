"""
REST API blueprint — all routes under /api/.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from dashboard.extensions import db
from dashboard.models import AuditLog, Guild, User
from dashboard.services.bot_state import get_bot_state

api_bp = Blueprint("api", __name__)


# ── Health ───────────────────────────────────────────────────────


@api_bp.get("/ping")
def ping():
    return jsonify({"ok": True})


@api_bp.get("/status")
@login_required
def status():
    return jsonify({
        "bot": get_bot_state(),
        "hub": {"status": "online", "version": "1.0.0"},
    })


# ── Public (no auth) ─────────────────────────────────────────────


@api_bp.get("/public/stats")
def public_stats():
    bot = get_bot_state()
    return jsonify({
        "guilds": bot["guild_count"],
        "members": bot["member_count"],
        "bot_online": bot["online"],
        "command_count": bot["command_count"],
        "version": bot["version"],
    })


# ── Bot state ────────────────────────────────────────────────────


@api_bp.get("/bot")
@login_required
def bot_state():
    return jsonify(get_bot_state())


@api_bp.get("/stats")
@login_required
def stats():
    bot = get_bot_state()
    return jsonify({
        "guilds": bot["guild_count"],
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


# ── Guilds ───────────────────────────────────────────────────────


@api_bp.get("/guilds")
@login_required
def guilds():
    qs = Guild.query.filter_by(is_active=True).order_by(Guild.name).all()
    return jsonify([{
        "id": g.id,
        "discord_id": g.discord_id,
        "name": g.name,
        "icon": g.icon,
        "member_count": g.member_count,
        "last_sync": g.last_sync.isoformat() if g.last_sync else None,
    } for g in qs])


@api_bp.get("/guilds/<string:discord_id>")
@login_required
def guild_detail(discord_id: str):
    guild = Guild.query.filter_by(discord_id=discord_id).first_or_404()
    return jsonify({
        "id": guild.id,
        "discord_id": guild.discord_id,
        "name": guild.name,
        "icon": guild.icon,
        "member_count": guild.member_count,
        "joined_at": guild.joined_at.isoformat() if guild.joined_at else None,
        "last_sync": guild.last_sync.isoformat() if guild.last_sync else None,
    })


# ── Users (admin) ────────────────────────────────────────────────


@api_bp.get("/users")
@login_required
def users():
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403
    qs = User.query.order_by(User.username).all()
    return jsonify([{
        "id": u.id,
        "username": u.username,
        "discord_id": u.discord_id,
        "is_admin": u.is_admin,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat(),
        "last_login": u.last_login.isoformat() if u.last_login else None,
    } for u in qs])


# ── Audit log (admin) ────────────────────────────────────────────


@api_bp.get("/audit")
@login_required
def audit():
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403
    limit = min(int(request.args.get("limit", 50)), 200)
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return jsonify([{
        "id": log.id,
        "action": log.action,
        "actor": log.actor.username if log.actor else None,
        "target_type": log.target_type,
        "target_id": log.target_id,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat(),
    } for log in logs])


# ── Admin actions ────────────────────────────────────────────────


@api_bp.post("/actions/<string:action>")
@login_required
def admin_action(action: str):
    if not current_user.is_admin:
        return jsonify({"error": "Forbidden"}), 403

    allowed = {"sync_guilds", "clear_cache", "reload_config"}
    if action not in allowed:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    from dashboard.extensions import redis_client
    redis_client.publish("hub:commands", action)

    _audit(current_user.id, f"admin_action:{action}", request.remote_addr)
    return jsonify({"ok": True, "action": action})


def _audit(actor_id: int, action: str, ip: str | None) -> None:
    entry = AuditLog(actor_id=actor_id, action=action, ip_address=ip)
    db.session.add(entry)
    db.session.commit()

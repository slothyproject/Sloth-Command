"""
AI Operator — natural language command interpreter for Discord operations.

Converts natural language into structured bot API calls via the
Dissident backend bridge, supporting moderation, tickets, settings, etc.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from dashboard.extensions import db
from dashboard.models import (
    AuditLog,
    Guild,
    GuildMember,
    GuildSettings,
    ModerationCase,
    Ticket,
    User,
    UserAIProviderCredential,
    UserAIProviderUsageStat,
)
from dashboard.services.ai_provider import invoke_ai_provider
from dashboard.services.bot_state import push_bot_command
from dashboard.services.dissident_api import call_dissident_api
from dashboard.services.encryption import decrypt_secret

log = logging.getLogger(__name__)

operator_bp = Blueprint("operator", __name__)


def _audit(action: str, guild_id: int | None = None, target_type: str | None = None,
           target_id: str | None = None, details: dict | None = None) -> None:
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

# ── System prompt ─────────────────────────────────────────────────

_OPERATOR_SYSTEM_PROMPT = (
    "You are an expert Discord bot operator called 'Sloth Operator'. "
    "You translate natural language commands into structured JSON operation chains.\n\n"
    "Available operations:\n"
    "- moderation/ban   { guildId, userId, reason?, duration?, deleteMessages? }\n"
    "- moderation/kick  { guildId, userId, reason? }\n"
    "- moderation/mute  { guildId, userId, reason?, duration }\n"
    "- moderation/unmute{ guildId, userId, reason? }\n"
    "- moderation/warn  { guildId, userId, reason? }\n"
    "- moderation/unban { guildId, userId, reason? }\n"
    "- moderation/purge    { guildId, channelId, limit }\n"
    "- moderation/slowmode { guildId, channelId, seconds }\n"
    "- moderation/lock     { guildId, channelId }\n"
    "- moderation/unlock   { guildId, channelId }\n"
    "- settings/update     { guildId, key, value }\n"
    "- role/assign    { guildId, userId, roleId, reason? }\n"
    "- role/remove    { guildId, userId, roleId, reason? }\n"
    "- role/create    { guildId, roleName, reason? }\n"
    "- role/delete    { guildId, roleId, reason? }\n"
    "- channel/create { guildId, name, type:text|voice, reason? }\n"
    "- channel/delete { guildId, channelId, reason? }\n"
    "- channel/rename { guildId, channelId, name, reason? }\n"
    "- voice/join     { guildId, channelId }\n"
    "- voice/leave    { guildId }\n"
    "- voice/move     { guildId, userId, channelId }\n"
    "- message/send   { guildId, channelId, content }\n"
    "- message/pin    { guildId, channelId, messageId }\n"
    "- message/unpin  { guildId, channelId, messageId }\n"
    "- message/bulk_delete { guildId, channelId, limit }\n"
    "- tickets/open   { guildId, userId, subject, priority?, reason? }\n"
    "- tickets/close  { guildId, ticketId, reason? }\n"
    "- welcome/post   { guildId, userId, message? }\n"
    "- automod/toggle { guildId, enabled }\n"
    "- logging/toggle { guildId, key, enabled }\n"
    "- emoji/remove   { guildId, name, reason? }\n"
    "- bulk/mute      { guildId, userIds[], reason?, duration? }\n"
    "- bulk/ban       { guildId, userIds[], reason?, deleteMessages? }\n"
    "- massmessage    { guildId, channelId, message }\n\n"
    "When the user says something ambiguous, generate a JSON plan and set "
    '"need_confirmation": true. When confident, set it to false.\n\n'
    "Output ONLY valid JSON like this (no markdown, no preamble):\n"
    '{\n'
    '  "plan": [\n'
    '    {"op": "moderation/mute", "params": {"guildId": "...", "userId": "...", "duration": 3600, "reason": "..."}}\n'
    '  ],\n'
    '  "summary": "human-readable summary",\n'
    '  "need_confirmation": false,\n'
    '  "research_used": false\n'
    '}\n\n'
    "Rules:\n"
    "- reason/default: use 'No reason provided' if not specified\n"
    "- duration/default: use 3600 (1h) if not specified\n"
    "- Extract user identifiers from mentions, IDs, or names\n"
    "- If guild is unclear, ask in summary and set need_confirmation: true"
)

# ── Helpers ────────────────────────────────────────────────────────


def _get_ai_credential() -> UserAIProviderCredential | None:
    return UserAIProviderCredential.query.filter_by(
        user_id=current_user.id, status="active"
    ).first()


def _decrypt_key(cred: UserAIProviderCredential) -> str | None:
    try:
        return decrypt_secret(cred.encrypted_api_key, cred.api_key_iv)
    except Exception:
        return None


def _check_rate_limit(cred: UserAIProviderCredential) -> tuple[bool, str | None]:
    usage = UserAIProviderUsageStat.query.filter_by(user_id=current_user.id).first()
    if not usage:
        return True, None
    now = datetime.now(timezone.utc)
    window = usage.current_hour_started_at
    if window and window.tzinfo is None:
        window = window.replace(tzinfo=timezone.utc)
    if window and window + timedelta(hours=1) > now:
        limit = cred.usage_limit_requests_per_hour or 100
        if usage.requests_this_hour >= limit:
            return False, f"Hourly limit of {limit} requests reached"
    return True, None


def _record_usage(token_count: int = 0, error: str | None = None) -> None:
    usage = UserAIProviderUsageStat.query.filter_by(user_id=current_user.id).first()
    if not usage:
        usage = UserAIProviderUsageStat(user_id=current_user.id)
        db.session.add(usage)
    now = datetime.now(timezone.utc)
    window = usage.current_hour_started_at
    if window and window.tzinfo is None:
        window = window.replace(tzinfo=timezone.utc)
    if not window or window + timedelta(hours=1) <= now:
        usage.current_hour_started_at = now.replace(minute=0, second=0, microsecond=0)
        usage.requests_this_hour = 0
        usage.tokens_this_hour = 0
    usage.requests_this_hour = (usage.requests_this_hour or 0) + 1
    usage.tokens_this_hour = (usage.tokens_this_hour or 0) + token_count
    usage.lifetime_requests = (usage.lifetime_requests or 0) + 1
    usage.lifetime_tokens = (usage.lifetime_tokens or 0) + token_count
    usage.last_used_at = now
    usage.last_command = "ai_operator"
    usage.last_error = error
    db.session.commit()


def _resolve_guild_id(value: str | int | None) -> Guild | None:
    if not value:
        return None
    value_str = str(value).strip()
    # Try numeric hub ID first
    if value_str.isdigit():
        guild = db.session.get(Guild, int(value_str))
        if guild:
            return guild
    # Try discord_id
    guild = Guild.query.filter_by(discord_id=value_str).first()
    return guild


def _can_execute(op: str, params: dict) -> tuple[bool, str | None]:
    """Verify the current user has permission to run this operation."""
    guild_id = params.get("guildId")
    guild = _resolve_guild_id(guild_id)
    if not guild:
        return False, "Guild not found"
    if current_user.is_owner or current_user.is_admin:
        return True, None
    membership = GuildMember.query.filter_by(
        user_id=current_user.id, guild_id=guild.id
    ).first()
    if not membership or not membership.can_manage:
        return False, f"You do not have permission to manage {guild.name}"
    return True, None


def _execute_step(op: str, params: dict) -> dict:
    """Execute a single operation via the Dissident API bridge."""
    if op.startswith("moderation/"):
        action = op.split("/", 1)[1]
        payload = {
            "guildId": str(params.get("guildId")),
            "userId": str(params.get("userId")),
            "reason": params.get("reason", "No reason provided"),
        }
        if "duration" in params:
            payload["duration"] = int(params["duration"])
        if "deleteMessages" in params:
            payload["deleteMessages"] = bool(params["deleteMessages"])
        status, result = call_dissident_api(
            "POST", f"moderation/{action}", current_user, json_payload=payload
        )
        return {"status": status, "result": result, "ok": status < 300}

    if op == "tickets/open":
        payload = {
            "guildId": str(params.get("guildId")),
            "userId": str(params.get("userId")),
            "subject": params.get("subject", "Support ticket"),
            "priority": params.get("priority", "normal"),
            "reason": params.get("reason", ""),
        }
        status, result = call_dissident_api(
            "POST", "tickets", current_user, json_payload=payload
        )
        return {"status": status, "result": result, "ok": status < 300}

    if op == "settings/update":
        guild = _resolve_guild_id(params.get("guildId"))
        if not guild:
            return {"ok": False, "error": "Guild not found"}
        if not guild.settings:
            guild.settings = GuildSettings(guild_id=guild.id)
            db.session.add(guild.settings)
        key = str(params.get("key", ""))
        value = params.get("value")
        if hasattr(guild.settings, key):
            setattr(guild.settings, key, value)
            db.session.commit()
            return {"ok": True, "updated": key, "value": value}
        return {"ok": False, "error": f"Unknown setting: {key}"}

    if op == "automod/toggle":
        guild = _resolve_guild_id(params.get("guildId"))
        if not guild:
            return {"ok": False, "error": "Guild not found"}
        if not guild.settings:
            guild.settings = GuildSettings(guild_id=guild.id)
            db.session.add(guild.settings)
        guild.settings.automod_enabled = bool(params.get("enabled", False))
        db.session.commit()
        return {"ok": True, "automod_enabled": guild.settings.automod_enabled}

    # ── Voice ─────────────────────────────────
    if op.startswith("voice/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action}
        if "channelId" in params:
            payload["channelId"] = str(params.get("channelId"))
        if "userId" in params:
            payload["userId"] = str(params.get("userId"))
        push_bot_command("voice_action", payload)
        return {"ok": True, "action": action, "queued": True}

    # ── Role ──────────────────────────────────
    if op.startswith("role/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action,
                   "reason": params.get("reason", "Dashboard action")}
        if "userId" in params:
            payload["userId"] = str(params.get("userId"))
        if "roleId" in params:
            payload["roleId"] = str(params.get("roleId"))
        if "roleName" in params:
            payload["roleName"] = str(params.get("roleName"))
        push_bot_command("role_action", payload)
        return {"ok": True, "action": action, "queued": True}

    # ── Channel ───────────────────────────────
    if op.startswith("channel/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action,
                   "reason": params.get("reason", "Dashboard action")}
        if "channelId" in params:
            payload["channelId"] = str(params.get("channelId"))
        if "name" in params:
            payload["name"] = str(params.get("name"))
        if "type" in params:
            payload["type"] = str(params.get("type"))
        push_bot_command("channel_action", payload)
        return {"ok": True, "action": action, "queued": True}

    # ── Message ───────────────────────────────
    if op.startswith("message/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action,
                   "reason": params.get("reason", "Dashboard action")}
        if "channelId" in params:
            payload["channelId"] = str(params.get("channelId"))
        if "messageId" in params:
            payload["messageId"] = str(params.get("messageId"))
        if "content" in params:
            payload["content"] = str(params.get("content"))
        if action == "bulk_delete":
            payload["limit"] = int(params.get("limit", 100))
        push_bot_command("message_action", payload)
        return {"ok": True, "action": action, "queued": True}

    # ── Emoji ─────────────────────────────────
    if op.startswith("emoji/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action,
                   "reason": params.get("reason", "Dashboard action")}
        if "name" in params:
            payload["name"] = str(params.get("name"))
        if "imageUrl" in params:
            payload["imageUrl"] = str(params.get("imageUrl"))
        push_bot_command("emoji_action", payload)
        return {"ok": True, "action": action, "queued": True}

    # ── Bulk ──────────────────────────────────
    if op.startswith("bulk/"):
        action = op.split("/", 1)[1]
        payload = {"guildId": str(params.get("guildId")), "action": action,
                   "reason": params.get("reason", "No reason provided")}
        if "userIds" in params:
            payload["userIds"] = [str(u) for u in params.get("userIds", [])]
        if "duration" in params:
            payload["duration"] = int(params["duration"])
        if "deleteMessages" in params:
            payload["deleteMessages"] = bool(params["deleteMessages"])
        push_bot_command("moderation_action", payload)
        return {"ok": True, "action": action, "queued": True}

    if op == "massmessage":
        payload = {
            "guildId": str(params.get("guildId")),
            "channelId": str(params.get("channelId")),
            "content": str(params.get("message", "")),
        }
        push_bot_command("message_action", {"action": "send", **payload})
        return {"ok": True, "action": "massmessage", "queued": True}

    return {"ok": False, "error": f"Unsupported operation: {op}"}



# ── Routes ───────────────────────────────────────────────────────


@operator_bp.post("/ai/operator")
@login_required
def ai_operator():
    """Parse a natural language command into an operation plan and optionally execute."""
    credential = _get_ai_credential()
    if not credential:
        return jsonify({"ok": False, "error": "AI provider not configured. Go to Settings → AI Provider."}), 400

    ok, err = _check_rate_limit(credential)
    if not ok:
        return jsonify({"ok": False, "error": err}), 429

    plain_key = _decrypt_key(credential)
    if not plain_key:
        return jsonify({"ok": False, "error": "Could not decrypt AI key. Re-save your settings."}), 503

    data = request.get_json(silent=True) or {}
    message = str(data.get("message") or "").strip()
    if not message:
        return jsonify({"ok": False, "error": "message is required"}), 400

    research = bool(data.get("research", False))
    guild_id = data.get("guild_id")
    dry_run = bool(data.get("dry_run", True))  # safe default

    # Build extra context from live data if research mode is on
    research_context = ""
    if research and guild_id:
        guild = _resolve_guild_id(guild_id)
        if guild:
            cases = (
                ModerationCase.query.filter_by(guild_id=guild.id)
                .order_by(ModerationCase.created_at.desc())
                .limit(5)
                .all()
            )
            tickets_open = Ticket.query.filter_by(
                guild_id=guild.id, status="open"
            ).count()
            research_context = (
                f"\n[Live data for '{guild.name}']\n"
                f"- Open tickets: {tickets_open}\n"
                f"- Recent mod cases: " + ", ".join(
                    f"{c.action} ({c.target_name or c.target_id})" for c in cases
                ) + "\n"
            )

    full_prompt = message + research_context

    result = invoke_ai_provider(
        provider=credential.provider,
        api_key=plain_key,
        model=credential.model,
        base_url=credential.base_url,
        prompt=full_prompt,
        system_prompt=_OPERATOR_SYSTEM_PROMPT,
        max_tokens=1200,
        timeout=60,
    )

    _record_usage(
        token_count=result.get("prompt_tokens", 0) + result.get("completion_tokens", 0),
        error=result.get("error") if not result.get("ok") else None,
    )

    if not result.get("ok"):
        return jsonify({"ok": False, "error": result.get("error", "AI provider error")}), 502

    # Parse JSON plan
    text = result["text"].strip()
    # Strip markdown fences if present
    for fence in ("```json", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
        if text.endswith("```"):
            text = text[:-3]
    text = text.strip()

    try:
        plan = json.loads(text)
    except json.JSONDecodeError as exc:
        return jsonify({
            "ok": False,
            "error": "AI returned invalid JSON",
            "raw": text[:500],
            "details": str(exc),
        }), 502

    steps = plan.get("plan", [])
    need_confirmation = bool(plan.get("need_confirmation", True))
    summary = str(plan.get("summary", ""))

    results: list[dict[str, Any]] = []
    if not dry_run and not need_confirmation:
        for step in steps:
            op = str(step.get("op", ""))
            params = step.get("params", {})
            perm_ok, perm_err = _can_execute(op, params)
            if not perm_ok:
                results.append({"op": op, "ok": False, "error": perm_err})
                continue
            exec_result = _execute_step(op, params)
            results.append({"op": op, **exec_result})
            # Audit
            _audit(
                f"operator_exec:{op}",
                guild_id=_resolve_guild_id(params.get("guildId")).id if _resolve_guild_id(params.get("guildId")) else None,
                target_type="operator_step",
                target_id=str(params.get("userId", "")),
                details={"params": params, "result": exec_result},
            )

    return jsonify({
        "ok": True,
        "summary": summary,
        "need_confirmation": need_confirmation,
        "steps": steps,
        "results": results,
        "research_used": research,
        "dry_run": dry_run,
    })


@operator_bp.post("/ai/operator/confirm")
@login_required
def ai_operator_confirm():
    """Execute a previously previewed plan."""
    data = request.get_json(silent=True) or {}
    steps = data.get("steps", [])
    if not steps:
        return jsonify({"ok": False, "error": "steps are required"}), 400

    results: list[dict[str, Any]] = []
    for step in steps:
        op = str(step.get("op", ""))
        params = step.get("params", {})
        perm_ok, perm_err = _can_execute(op, params)
        if not perm_ok:
            results.append({"op": op, "ok": False, "error": perm_err})
            continue
        exec_result = _execute_step(op, params)
        results.append({"op": op, **exec_result})
        _audit(
            f"operator_exec:{op}",
            guild_id=_resolve_guild_id(params.get("guildId")).id if _resolve_guild_id(params.get("guildId")) else None,
            target_type="operator_step",
            target_id=str(params.get("userId", "")),
            details={"params": params, "result": exec_result},
        )

    return jsonify({"ok": True, "results": results})

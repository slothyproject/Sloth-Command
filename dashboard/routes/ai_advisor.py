"""
AI Advisor — Server Blueprint Generator & Executor.

Provides:
  POST /api/ai/advisor          — multi-turn chat with the advisor
  POST /api/ai/advisor/blueprint — generate a full server blueprint (JSON)
  POST /api/ai/advisor/execute   — execute a blueprint on a Discord guild via bot token
"""
from __future__ import annotations

import os
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from dashboard.extensions import db
from dashboard.models import (
    Guild,
    UserAIProviderCredential,
    UserAIProviderUsageStat,
)
from dashboard.services.ai_provider import invoke_ai_provider
from dashboard.services.encryption import decrypt_secret

log = logging.getLogger(__name__)

advisor_bp = Blueprint("advisor", __name__)

# ── Discord REST base ──────────────────────────────────────────────────────
_DISCORD_API = "https://discord.com/api/v10"

# ── System prompts ──────────────────────────────────────────────────────────

_CHAT_SYSTEM = (
    "You are an expert Discord server architect and community manager called 'Sloth Advisor'. "
    "You help server owners design roles, channels, moderation strategies, onboarding flows, "
    "support ticket systems, and community engagement plans.\n\n"
    "You have two modes:\n"
    "1. CHAT MODE: Answer questions conversationally. Be concise and practical.\n"
    "2. BLUEPRINT MODE: When the user asks you to 'set up', 'create', 'build', or 'design' a server, "
    "you generate a structured JSON blueprint.\n\n"
    "When generating a blueprint, output ONLY valid JSON with this exact structure:\n"
    "{\n"
    '  "blueprint": {\n'
    '    "server_name": "string",\n'
    '    "description": "string",\n'
    '    "roles": [{"name": "string", "color": "#hex", "hoist": bool, "mentionable": bool, "permissions": ["SEND_MESSAGES","READ_MESSAGES",...]}],\n'
    '    "categories": [\n'
    '      {\n'
    '        "name": "string",\n'
    '        "channels": [\n'
    '          {"name": "string", "type": "text"|"voice"|"forum"|"announcement", "topic": "string", "nsfw": false, "slowmode": 0}\n'
    '        ]\n'
    '      }\n'
    '    ],\n'
    '    "summary": "string — a 1-2 sentence human-readable summary of what was created"\n'
    "  }\n"
    "}\n\n"
    "Available Discord permissions: ADMINISTRATOR, MANAGE_GUILD, MANAGE_CHANNELS, MANAGE_ROLES, "
    "MANAGE_MESSAGES, KICK_MEMBERS, BAN_MEMBERS, SEND_MESSAGES, READ_MESSAGES, "
    "EMBED_LINKS, ATTACH_FILES, ADD_REACTIONS, USE_SLASH_COMMANDS, MUTE_MEMBERS, "
    "DEAFEN_MEMBERS, MOVE_MEMBERS, CONNECT, SPEAK, VIEW_CHANNEL.\n\n"
    "Rules:\n"
    "- Channel names: lowercase-hyphenated (e.g. general-chat)\n"
    "- 3–8 roles max, 2–6 categories, 2–8 channels per category\n"
    "- Never give broad member roles admin-like authority\n"
    "- Colors: use vivid hex codes that suit the server theme\n"
    "- In CHAT MODE, suggest blueprint mode if relevant\n"
)

_BLUEPRINT_SYSTEM = (
    "You are a Discord server architect. Output ONLY valid JSON — no markdown, no explanation, no preamble.\n"
    "Generate a complete server blueprint based on the user's description.\n\n"
    "Output this exact JSON structure:\n"
    "{\n"
    '  "blueprint": {\n'
    '    "server_name": "string",\n'
    '    "description": "string",\n'
    '    "roles": [\n'
    '      {"name": "string", "color": "#hex", "hoist": true, "mentionable": false, '
    '"permissions": ["VIEW_CHANNEL","SEND_MESSAGES"]}\n'
    '    ],\n'
    '    "categories": [\n'
    '      {\n'
    '        "name": "string",\n'
    '        "channels": [\n'
    '          {"name": "string", "type": "text", "topic": "string", "nsfw": false, "slowmode": 0}\n'
    '        ]\n'
    '      }\n'
    '    ],\n'
    '    "summary": "string"\n'
    '  }\n'
    "}\n\n"
    "Rules:\n"
    "- Channel names: lowercase-hyphenated only\n"
    "- 3–8 roles, 2–6 categories, 2–8 channels per category\n"
    "- Colors: vivid hex matching the theme\n"
    "- Never give everyone/member roles admin permissions\n"
    "- Make the blueprint specific to what was described, not generic\n"
)

# ── Permission name → Discord bitfield ────────────────────────────────────
_PERM_BITS: dict[str, int] = {
    "CREATE_INSTANT_INVITE": 1 << 0,
    "KICK_MEMBERS": 1 << 1,
    "BAN_MEMBERS": 1 << 2,
    "ADMINISTRATOR": 1 << 3,
    "MANAGE_CHANNELS": 1 << 4,
    "MANAGE_GUILD": 1 << 5,
    "ADD_REACTIONS": 1 << 6,
    "VIEW_AUDIT_LOG": 1 << 7,
    "PRIORITY_SPEAKER": 1 << 8,
    "STREAM": 1 << 9,
    "VIEW_CHANNEL": 1 << 10,
    "READ_MESSAGES": 1 << 10,
    "SEND_MESSAGES": 1 << 11,
    "SEND_TTS_MESSAGES": 1 << 12,
    "MANAGE_MESSAGES": 1 << 13,
    "EMBED_LINKS": 1 << 14,
    "ATTACH_FILES": 1 << 15,
    "READ_MESSAGE_HISTORY": 1 << 16,
    "MENTION_EVERYONE": 1 << 17,
    "USE_EXTERNAL_EMOJIS": 1 << 18,
    "VIEW_GUILD_INSIGHTS": 1 << 19,
    "CONNECT": 1 << 20,
    "SPEAK": 1 << 21,
    "MUTE_MEMBERS": 1 << 22,
    "DEAFEN_MEMBERS": 1 << 23,
    "MOVE_MEMBERS": 1 << 24,
    "USE_VAD": 1 << 25,
    "CHANGE_NICKNAME": 1 << 26,
    "MANAGE_NICKNAMES": 1 << 27,
    "MANAGE_ROLES": 1 << 28,
    "MANAGE_WEBHOOKS": 1 << 29,
    "MANAGE_EMOJIS": 1 << 30,
    "USE_SLASH_COMMANDS": 1 << 31,
    "REQUEST_TO_SPEAK": 1 << 32,
    "MANAGE_EVENTS": 1 << 33,
    "MANAGE_THREADS": 1 << 34,
    "CREATE_PUBLIC_THREADS": 1 << 35,
    "CREATE_PRIVATE_THREADS": 1 << 36,
    "USE_EXTERNAL_STICKERS": 1 << 37,
    "SEND_MESSAGES_IN_THREADS": 1 << 38,
    "USE_EMBEDDED_ACTIVITIES": 1 << 39,
    "MODERATE_MEMBERS": 1 << 40,
}

_CHANNEL_TYPES = {"text": 0, "voice": 2, "category": 4, "announcement": 5, "forum": 15}


def _perms_to_bits(perms: list[str]) -> str:
    bits = 0
    for p in perms:
        bits |= _PERM_BITS.get(p.upper(), 0)
    return str(bits)


def _hex_to_int(color: str) -> int:
    try:
        return int(color.lstrip("#"), 16)
    except (ValueError, AttributeError):
        return 0


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_credential(user) -> UserAIProviderCredential | None:
    return UserAIProviderCredential.query.filter_by(user_id=user.id).first()


def _decrypt_key(credential: UserAIProviderCredential) -> str | None:
    try:
        return decrypt_secret(credential.encrypted_api_key, credential.api_key_iv)
    except Exception:
        return None


def _record_usage(user, command: str, success: bool, tokens: int = 0, error: str | None = None):
    now = datetime.now(timezone.utc)
    usage = UserAIProviderUsageStat.query.filter_by(user_id=user.id).first()
    if not usage:
        usage = UserAIProviderUsageStat(user_id=user.id)
        db.session.add(usage)

    window = usage.current_hour_started_at
    if window and window.tzinfo is None:
        window = window.replace(tzinfo=timezone.utc)
    if not window or window + timedelta(hours=1) <= now:
        usage.current_hour_started_at = now.replace(minute=0, second=0, microsecond=0)
        usage.requests_this_hour = 0
        usage.tokens_this_hour = 0

    usage.requests_this_hour = (usage.requests_this_hour or 0) + 1
    usage.tokens_this_hour = (usage.tokens_this_hour or 0) + tokens
    usage.lifetime_requests = (usage.lifetime_requests or 0) + 1
    usage.lifetime_tokens = (usage.lifetime_tokens or 0) + tokens
    usage.last_used_at = now
    usage.last_command = command
    usage.last_error = error
    db.session.commit()


def _check_rate_limit(user) -> tuple[bool, str | None]:
    credential = _get_credential(user)
    if not credential:
        return False, "AI provider not configured"
    usage = user.ai_provider_usage
    if not usage:
        return True, None
    now = datetime.now(timezone.utc)
    window = usage.current_hour_started_at
    if window and window.tzinfo is None:
        window = window.replace(tzinfo=timezone.utc)
    if window and window + timedelta(hours=1) > now:
        limit = credential.usage_limit_requests_per_hour or 100
        if (usage.requests_this_hour or 0) >= limit:
            return False, f"Hourly limit of {limit} requests reached"
    return True, None


# ── Routes ─────────────────────────────────────────────────────────────────

@advisor_bp.post("/ai/advisor")
@login_required
def ai_advisor_chat():
    """Multi-turn advisor chat."""
    credential = _get_credential(current_user)

    # Security: require admin or guild context for execution-heavy advisor calls.
    data = request.get_json(silent=True) or {}
    guild_id = data.get("guild_id")
    if guild_id and not current_user.is_admin:
        from dashboard.models import Guild, GuildMember
        try:
            guild = db.session.get(Guild, int(guild_id))
            if not guild:
                return jsonify({"ok": False, "error": "Guild not found"}), 404
            membership = GuildMember.query.filter_by(user_id=current_user.id, guild_id=guild.id).first()
            if not membership or not membership.can_manage:
                return jsonify({"ok": False, "error": "You do not have permission to manage this guild"}), 403
        except (ValueError, TypeError):
            return jsonify({"ok": False, "error": "Invalid guild_id"}), 400
    if not credential or credential.status != "active":
        return jsonify({"ok": False, "error": "AI provider not configured. Go to Settings → AI Provider."}), 400

    ok, err = _check_rate_limit(current_user)
    if not ok:
        return jsonify({"ok": False, "error": err}), 429

    plain_key = _decrypt_key(credential)
    if not plain_key:
        return jsonify({"ok": False, "error": "Could not decrypt API key. Re-save your provider settings."}), 503

    data = request.get_json() or {}
    message = str(data.get("message") or "").strip()
    if not message:
        return jsonify({"ok": False, "error": "message is required"}), 400

    # Build conversation history
    history: list[dict[str, str]] = data.get("history", [])
    mode = str(data.get("mode") or "ask")
    guild_id = data.get("guild_id")

    context_prefix = ""
    if guild_id:
        guild = db.session.get(Guild, int(guild_id))
        if guild:
            context_prefix = f"[Server context: '{guild.name}', {guild.member_count or 0} members] "

    full_message = context_prefix + message
    if mode == "interview":
        full_message = "Please ask me clarifying questions one at a time to help design my server. " + full_message

    # Construct messages for multi-turn
    messages = [{"role": "system", "content": _CHAT_SYSTEM}]
    for turn in history[-20:]:  # keep last 20 turns for context
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])})
    messages.append({"role": "user", "content": full_message})

    result = invoke_ai_provider(
        provider=credential.provider,
        api_key=plain_key,
        model=credential.model,
        base_url=credential.base_url,
        prompt=full_message,
        system_prompt=_CHAT_SYSTEM,
        max_tokens=1200,
        timeout=60,
    )

    _record_usage(
        current_user, "ai_advisor_chat",
        success=result.get("ok", False),
        tokens=result.get("prompt_tokens", 0) + result.get("completion_tokens", 0),
        error=result.get("error") if not result.get("ok") else None,
    )

    if not result.get("ok"):
        return jsonify({"ok": False, "error": result.get("error", "AI provider error")}), 502

    text = result["text"]
    # Detect if the response contains a blueprint JSON
    blueprint = None
    if '{"blueprint"' in text or '"blueprint":' in text:
        import re
        import json as _json
        m = re.search(r'\{[\s\S]*"blueprint"[\s\S]*\}', text)
        if m:
            try:
                parsed = _json.loads(m.group())
                blueprint = parsed.get("blueprint")
                text = blueprint.get("summary", "Here's your server blueprint!")
            except Exception:
                pass

    return jsonify({
        "ok": True,
        "response": text,
        "blueprint": blueprint,
        "model": result["model"],
        "mode": mode,
    })


@advisor_bp.post("/ai/advisor/blueprint")
@login_required
def ai_advisor_blueprint():
    """Generate a structured server blueprint from a description."""
    credential = _get_credential(current_user)
    if not credential or credential.status != "active":
        return jsonify({"ok": False, "error": "AI provider not configured. Go to Settings → AI Provider."}), 400

    ok, err = _check_rate_limit(current_user)
    if not ok:
        return jsonify({"ok": False, "error": err}), 429

    plain_key = _decrypt_key(credential)
    if not plain_key:
        return jsonify({"ok": False, "error": "Could not decrypt API key."}), 503

    data = request.get_json() or {}
    description = str(data.get("description") or "").strip()
    if not description:
        return jsonify({"ok": False, "error": "description is required"}), 400

    result = invoke_ai_provider(
        provider=credential.provider,
        api_key=plain_key,
        model=credential.model,
        base_url=credential.base_url,
        prompt=f"Generate a complete Discord server blueprint for: {description}",
        system_prompt=_BLUEPRINT_SYSTEM,
        max_tokens=2000,
        timeout=90,
    )

    _record_usage(
        current_user, "ai_advisor_blueprint",
        success=result.get("ok", False),
        tokens=result.get("prompt_tokens", 0) + result.get("completion_tokens", 0),
        error=result.get("error") if not result.get("ok") else None,
    )

    if not result.get("ok"):
        return jsonify({"ok": False, "error": result.get("error", "AI provider error")}), 502

    import re
    import json as _json
    text = result["text"].strip()
    # Strip markdown code fences if present
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    text = text.strip()

    try:
        parsed = _json.loads(text)
        blueprint = parsed.get("blueprint") or parsed
    except Exception as e:
        # Try to extract JSON from within the text
        m = re.search(r'\{[\s\S]*\}', text)
        if m:
            try:
                parsed = _json.loads(m.group())
                blueprint = parsed.get("blueprint") or parsed
            except Exception:
                return jsonify({"ok": False, "error": f"Failed to parse blueprint JSON: {e}", "raw": text[:500]}), 502
        else:
            return jsonify({"ok": False, "error": "AI did not return valid JSON", "raw": text[:500]}), 502

    return jsonify({"ok": True, "blueprint": blueprint})


@advisor_bp.post("/ai/advisor/execute")
@login_required
def ai_advisor_execute():
    """
    Execute a blueprint on a Discord guild.

    Requires the bot token stored in DashboardBotCredential.
    Creates: roles, categories, channels.
    """
    from dashboard.models import DashboardBotCredential
    from dashboard.services.encryption import decrypt_secret

    data = request.get_json() or {}
    blueprint = data.get("blueprint")
    guild_discord_id = str(data.get("guild_id") or "").strip()

    if not blueprint:
        return jsonify({"ok": False, "error": "blueprint is required"}), 400
    if not guild_discord_id:
        return jsonify({"ok": False, "error": "guild_id is required"}), 400

    # Get bot token
    cfg = DashboardBotCredential.query.order_by(DashboardBotCredential.updated_at.desc()).first()
    if not cfg or not cfg.encrypted_token:
        return jsonify({"ok": False, "error": "Bot token not configured. Go to Settings → Bot Configuration."}), 400

    try:
        bot_token = decrypt_secret(cfg.encrypted_token, cfg.token_iv)
    except Exception:
        return jsonify({"ok": False, "error": "Could not decrypt bot token."}), 503

    headers = {
        "Authorization": f"Bot {bot_token}",
        "Content-Type": "application/json",
    }

    results = {
        "roles_created": [],
        "roles_failed": [],
        "channels_created": [],
        "channels_failed": [],
        "errors": [],
    }

    def discord_post(path: str, payload: dict) -> tuple[int, dict]:
        resp = requests.post(
            f"{_DISCORD_API}/{path.lstrip('/')}",
            headers=headers,
            json=payload,
            timeout=15,
        )
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, {"error": resp.text}

    def discord_patch(path: str, payload: dict) -> tuple[int, dict]:
        resp = requests.patch(
            f"{_DISCORD_API}/{path.lstrip('/')}",
            headers=headers,
            json=payload,
            timeout=15,
        )
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, {"error": resp.text}

    guild_path = f"guilds/{guild_discord_id}"

    # ── 1. Rename server if requested ──────────────────────────────────────
    server_name = blueprint.get("server_name")
    if server_name and data.get("rename_server"):
        status, resp = discord_patch(guild_path, {"name": server_name})
        if status >= 400:
            results["errors"].append(f"Rename server: {resp}")

    # ── 2. Create roles ────────────────────────────────────────────────────
    role_name_to_id: dict[str, str] = {}
    for role in blueprint.get("roles", []):
        name = role.get("name", "New Role")
        perms = _perms_to_bits(role.get("permissions", []))
        color = _hex_to_int(role.get("color", "#99aab5"))
        payload = {
            "name": name,
            "permissions": perms,
            "color": color,
            "hoist": bool(role.get("hoist", False)),
            "mentionable": bool(role.get("mentionable", False)),
        }
        status, resp = discord_post(f"{guild_path}/roles", payload)
        time.sleep(0.3)  # respect rate limits
        if status in (200, 201) and resp.get("id"):
            role_name_to_id[name] = resp["id"]
            results["roles_created"].append(name)
        else:
            results["roles_failed"].append({"name": name, "error": resp})

    # ── 3. Create categories and channels ─────────────────────────────────
    for category in blueprint.get("categories", []):
        cat_name = category.get("name", "Category")
        # Create category
        status, cat_resp = discord_post(f"{guild_path}/channels", {
            "name": cat_name,
            "type": _CHANNEL_TYPES["category"],
        })
        time.sleep(0.3)
        if status not in (200, 201) or not cat_resp.get("id"):
            results["channels_failed"].append({"name": cat_name, "type": "category", "error": cat_resp})
            continue

        cat_id = cat_resp["id"]
        results["channels_created"].append(f"📁 {cat_name}")

        for channel in category.get("channels", []):
            ch_name = str(channel.get("name", "channel")).lower().replace(" ", "-")
            ch_type_str = str(channel.get("type", "text")).lower()
            ch_type = _CHANNEL_TYPES.get(ch_type_str, 0)
            payload: dict[str, Any] = {
                "name": ch_name,
                "type": ch_type,
                "parent_id": cat_id,
            }
            if channel.get("topic") and ch_type == 0:
                payload["topic"] = str(channel["topic"])[:1024]
            if channel.get("nsfw") and ch_type == 0:
                payload["nsfw"] = True
            if channel.get("slowmode") and ch_type in (0, 15):
                payload["rate_limit_per_user"] = int(channel["slowmode"])

            status, ch_resp = discord_post(f"{guild_path}/channels", payload)
            time.sleep(0.3)
            if status in (200, 201) and ch_resp.get("id"):
                icon = "🔊" if ch_type == 2 else "📢" if ch_type == 5 else "💬" if ch_type == 15 else "#"
                results["channels_created"].append(f"  {icon} {ch_name}")
            else:
                results["channels_failed"].append({"name": ch_name, "error": ch_resp})

    total = len(results["roles_created"]) + len(results["channels_created"])
    failed = len(results["roles_failed"]) + len(results["channels_failed"])
    summary = f"Created {total} items ({len(results['roles_created'])} roles, {len(results['channels_created'])} channels/categories)"
    if failed:
        summary += f". {failed} failed."

    return jsonify({
        "ok": failed == 0,
        "summary": summary,
        "results": results,
    })

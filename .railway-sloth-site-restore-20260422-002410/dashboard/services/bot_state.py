"""
Bot state reader.

The Dissident bot writes its state to Redis key `dissident:bot_state` every 2s.
This service reads that key, normalises the field names, and returns a clean dict.
Falls back to a safe offline payload if Redis is unavailable.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from dashboard.extensions import redis_client

log = logging.getLogger(__name__)

# The key the bot actually writes to (from bot/api/shared_state.py)
_BOT_STATE_KEY = "dissident:bot_state"
_STALE_THRESHOLD = 30  # seconds

_OFFLINE: dict = {
    "online": False,
    "status": "offline",
    "guild_count": 0,
    "member_count": 0,
    "channel_count": 0,
    "commands_today": 0,
    "command_count": 0,
    "uptime": "offline",
    "uptime_seconds": 0,
    "latency_ms": 0,
    "cog_count": 0,
    "version": "unknown",
    "stale": True,
}


def get_bot_state() -> dict:
    """Return the latest bot state from Redis, normalised and safe."""
    try:
        raw = redis_client.get(_BOT_STATE_KEY)
        if not raw:
            return _OFFLINE.copy()

        data = json.loads(raw)
        stats = data.get("stats", data)  # bot wraps in {"stats": {...}}

        # Check staleness
        stale = _is_stale(data)

        return {
            "online": stats.get("status") == "online" and not stale,
            "status": stats.get("status", "offline"),
            "guild_count": stats.get("servers", 0),
            "member_count": stats.get("users", 0),
            "channel_count": stats.get("channels", 0),
            "commands_today": stats.get("commands_today", 0),
            "command_count": stats.get("command_count", 0),
            "uptime": stats.get("uptime", "offline"),
            "uptime_seconds": stats.get("uptime_seconds", 0),
            "latency_ms": stats.get("latency_ms", 0),
            "cog_count": stats.get("cogs_loaded", 0),
            "version": stats.get("version", "unknown"),
            "stale": stale,
            # Raw extras
            "guilds": data.get("guilds", []),
            "commands": data.get("commands", []),
            "plugins": data.get("plugins", []),
            "health": data.get("health", {}),
            "updated_at": data.get("updated_at"),
        }
    except Exception as exc:
        log.warning("Could not read bot state from Redis: %s", exc)
        return _OFFLINE.copy()


def _is_stale(data: dict) -> bool:
    updated_at = data.get("updated_at")
    if not updated_at:
        return True
    try:
        updated = datetime.fromisoformat(updated_at)
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - updated).total_seconds()
        return age > _STALE_THRESHOLD
    except Exception:
        return True


def push_bot_command(command: str, payload: dict | None = None) -> None:
    """Publish a command to the bot via Redis pub/sub."""
    message = json.dumps({"command": command, "payload": payload or {}})
    redis_client.publish("hub:commands", message)

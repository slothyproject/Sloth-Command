"""
Bot state reader.

The Dissident bot writes its state to Redis key `bot:state` every 2 seconds.
This service reads that key and returns a normalised dict.
Falls back to a safe "offline" payload if Redis is unavailable or the key
doesn't exist yet — so the dashboard never crashes because the bot is down.
"""
from __future__ import annotations

import json
import logging

from dashboard.extensions import redis_client

log = logging.getLogger(__name__)

_OFFLINE_STATE: dict = {
    "online": False,
    "guild_count": 0,
    "member_count": 0,
    "command_count": 0,
    "commands_today": 0,
    "uptime": "offline",
    "latency_ms": 0,
    "cog_count": 0,
    "version": "unknown",
}


def get_bot_state() -> dict:
    """Return the latest bot state from Redis, or a safe offline payload."""
    try:
        raw = redis_client.get("bot:state")
        if not raw:
            return _OFFLINE_STATE.copy()
        data = json.loads(raw)
        # Ensure all expected keys exist
        return {**_OFFLINE_STATE, **data}
    except Exception as exc:
        log.warning("Could not read bot state from Redis: %s", exc)
        return _OFFLINE_STATE.copy()


def push_bot_command(command: str, payload: dict | None = None) -> None:
    """
    Publish a command to the bot via Redis pub/sub.
    The bot subscribes to hub:commands and acts on them.
    """
    message = json.dumps({"command": command, "payload": payload or {}})
    redis_client.publish("hub:commands", message)

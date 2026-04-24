"""
Discord Bot Bridge - Real-time connection between dashboard and bot.
v4.0.0 - Redis-first state sharing for Railway multi-service deployments

State priority:
  1. Redis (bot writes here every 2s - works across Railway containers)
  2. bot_state.json (local dev fallback)
  3. Empty defaults
"""

import json
import os
import threading
import time
from pathlib import Path
from typing import Dict, Optional, Callable

DATA_DIR = Path(__file__).parent.parent / "data"
STATE_FILE = DATA_DIR / "bot_state.json"
REDIS_STATE_KEY = "dissident:bot_state"
REDIS_TTL = 60  # seconds


def _get_redis_client():
    """Get Redis client from environment. Returns None if unavailable."""
    try:
        import redis
        redis_url = (
            os.environ.get("REDIS_URL") or
            os.environ.get("DISSIDENT_REDIS_URL")
        )
        if redis_url:
            return redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        host = os.environ.get("REDIS_HOST", os.environ.get("DISSIDENT_REDIS_HOST", "localhost"))
        port = int(os.environ.get("REDIS_PORT", os.environ.get("DISSIDENT_REDIS_PORT", 6379)))
        password = os.environ.get("REDIS_PASSWORD", os.environ.get("DISSIDENT_REDIS_PASSWORD", ""))
        return redis.Redis(
            host=host, port=port, password=password or None,
            decode_responses=True, socket_timeout=2
        )
    except Exception:
        return None


class SharedStateReader:
    """
    Thread-safe reader for bot state.
    Reads from Redis first (works across Railway containers),
    falls back to bot_state.json for local development.
    """
    _lock = threading.Lock()
    _cache: Dict = {}
    _cache_time: float = 0.0
    _cache_ttl: float = 5.0
    _redis = None
    _redis_checked: bool = False

    @classmethod
    def _get_redis(cls):
        if not cls._redis_checked:
            cls._redis = _get_redis_client()
            cls._redis_checked = True
        return cls._redis

    @classmethod
    def _read_from_redis(cls) -> Optional[dict]:
        """Try to read bot state from Redis."""
        try:
            r = cls._get_redis()
            if r is None:
                return None
            raw = r.get(REDIS_STATE_KEY)
            if raw:
                return json.loads(raw)
        except Exception as e:
            print(f"[BotBridge] Redis read error: {e}")
            cls._redis = None
            cls._redis_checked = False
        return None

    @classmethod
    def _read_from_file(cls) -> dict:
        """Fall back to reading bot_state.json."""
        try:
            if STATE_FILE.exists():
                with open(STATE_FILE, "r") as f:
                    return json.load(f)
        except Exception as e:
            print(f"[BotBridge] File read error: {e}")
        return {}

    @classmethod
    def get_state(cls) -> dict:
        """Get bot state with caching."""
        now = time.time()
        with cls._lock:
            if now - cls._cache_time < cls._cache_ttl and cls._cache:
                return cls._cache.copy()

        state = cls._read_from_redis() or cls._read_from_file()

        with cls._lock:
            cls._cache = state
            cls._cache_time = now

        return state.copy()

    @classmethod
    def get_stats(cls) -> dict:
        state = cls.get_state()
        return state.get("stats", _default_stats())

    @classmethod
    def get_guilds(cls) -> list:
        state = cls.get_state()
        return state.get("guilds", [])

    @classmethod
    def get_commands(cls) -> list:
        state = cls.get_state()
        return state.get("commands", [])

    @classmethod
    def get_plugins(cls) -> list:
        state = cls.get_state()
        return state.get("plugins", [])

    @classmethod
    def is_online(cls) -> bool:
        stats = cls.get_stats()
        return stats.get("status") == "online"

    @classmethod
    def is_stale(cls, max_age_seconds: int = 30) -> bool:
        from datetime import datetime, timezone
        state = cls.get_state()
        updated_at = state.get("updated_at")
        if not updated_at:
            return True
        try:
            updated = datetime.fromisoformat(updated_at)
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - updated).total_seconds()
            return age > max_age_seconds
        except Exception:
            return True

    @classmethod
    def invalidate_cache(cls):
        with cls._lock:
            cls._cache = {}
            cls._cache_time = 0.0

    @classmethod
    def get_servers(cls) -> list:
        """Alias for get_guilds — used by web_panel/app.py."""
        return cls.get_guilds()

    @classmethod
    def get_activity(cls) -> dict:
        state = cls.get_state()
        return state.get("activity", {
            "commands_today": 0,
            "messages_today": 0,
            "joins_today": 0,
            "leaves_today": 0,
        })

    @classmethod
    def get_economy(cls) -> dict:
        state = cls.get_state()
        return state.get("economy", {"total_coins": 0, "transactions_today": 0})

    @classmethod
    def get_moderation_cases(cls) -> list:
        state = cls.get_state()
        return state.get("moderation_cases", [])

    @classmethod
    def get_tickets(cls) -> list:
        state = cls.get_state()
        return state.get("tickets", [])



def _default_stats() -> dict:
    return {
        "status": "offline",
        "uptime": "00:00:00",
        "uptime_seconds": 0,
        "servers": 0,
        "users": 0,
        "channels": 0,
        "cogs_loaded": 0,
        "plugin_count": 0,
        "latency_ms": 0,
        "commands_today": 0,
        "messages_today": 0,
        "version": "unknown",
    }


# Convenience module-level functions
def get_bot_state() -> dict:
    return SharedStateReader.get_state()

def get_bot_stats() -> dict:
    return SharedStateReader.get_stats()

def get_bot_guilds() -> list:
    return SharedStateReader.get_guilds()

def is_bot_online() -> bool:
    return SharedStateReader.is_online()

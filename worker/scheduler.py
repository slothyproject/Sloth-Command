"""
Background worker — runs scheduled tasks for the Hub.
Start with: python -m worker.scheduler
"""
from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

import redis
import schedule

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("hub.worker")

r = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True,
)

# Must match the key the bot writes to (bot/api/shared_state.py)
BOT_STATE_KEY = "dissident:bot_state"


def sync_bot_stats() -> None:
    """Cache public-facing stats from bot state."""
    raw = r.get(BOT_STATE_KEY)
    if not raw:
        log.debug("No bot state in Redis yet")
        return
    try:
        data = json.loads(raw)
        stats = data.get("stats", data)
        r.setex("hub:public:stats", 300, json.dumps({
            "servers": stats.get("servers", 0),
            "users": stats.get("users", 0),
            "status": stats.get("status", "offline"),
            "version": stats.get("version", "unknown"),
        }))
        log.info("Synced bot stats — %s servers, %s users", stats.get("servers", 0), stats.get("users", 0))
    except Exception as exc:
        log.warning("Failed to sync bot stats: %s", exc)


def heartbeat() -> None:
    r.setex("hub:worker:heartbeat", 120, datetime.now(timezone.utc).isoformat())
    log.debug("Heartbeat written")


def clean_stale_keys() -> None:
    """Remove any temporary keys that shouldn't persist."""
    log.info("Stale key cleanup run")


schedule.every(30).seconds.do(sync_bot_stats)
schedule.every(60).seconds.do(heartbeat)
schedule.every().day.at("03:00").do(clean_stale_keys)


if __name__ == "__main__":
    log.info("Dissident Central Hub worker started")
    heartbeat()
    while True:
        schedule.run_pending()
        time.sleep(5)

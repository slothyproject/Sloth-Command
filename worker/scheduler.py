"""
Background worker — runs scheduled tasks for the Hub.
Runs as a separate process in Railway (not inside the web server).

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

r = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)


# ── Tasks ────────────────────────────────────────────────────────


def sync_guild_count() -> None:
    """Pull guild count from bot state into a dedicated key for public stats."""
    raw = r.get("bot:state")
    if not raw:
        return
    data = json.loads(raw)
    r.set("hub:public:guild_count", data.get("guild_count", 0), ex=300)
    log.info("Synced guild count: %s", data.get("guild_count", 0))


def heartbeat() -> None:
    """Write a worker heartbeat so the dashboard can confirm the worker is alive."""
    r.set(
        "hub:worker:heartbeat",
        datetime.now(timezone.utc).isoformat(),
        ex=120,
    )
    log.debug("Heartbeat written")


def clean_stale_sessions() -> None:
    """Expire any Redis-backed sessions older than 7 days."""
    log.info("Session cleanup run (placeholder — implement as needed)")


# ── Schedule ─────────────────────────────────────────────────────


schedule.every(30).seconds.do(sync_guild_count)
schedule.every(60).seconds.do(heartbeat)
schedule.every().day.at("03:00").do(clean_stale_sessions)


if __name__ == "__main__":
    log.info("Dissident Central Hub worker started")
    heartbeat()
    while True:
        schedule.run_pending()
        time.sleep(5)

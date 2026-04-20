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

BOT_STATE_KEY = "dissident:bot_state"


# ── Tasks ────────────────────────────────────────────────────────


def sync_guilds() -> None:
    """
    Read guild list from bot Redis state and upsert into hub_guilds table.
    This is how the Hub learns which servers the bot is in.
    """
    raw = r.get(BOT_STATE_KEY)
    if not raw:
        log.debug("No bot state in Redis — skipping guild sync")
        return

    try:
        data = json.loads(raw)
    except Exception as e:
        log.warning("Failed to parse bot state: %s", e)
        return

    guilds = data.get("guilds", [])
    if not guilds:
        log.debug("Bot state has no guild list yet")
        return

    # Import Flask app to get DB context
    try:
        from dashboard.app import create_app
        from dashboard.extensions import db
        from dashboard.models import Guild

        app = create_app()
        with app.app_context():
            now = datetime.now(timezone.utc)
            updated = 0
            for g in guilds:
                discord_id = str(g.get("id", ""))
                if not discord_id:
                    continue

                existing = Guild.query.filter_by(discord_id=discord_id).first()
                if existing:
                    existing.name = g.get("name", existing.name)
                    existing.icon = g.get("icon")
                    existing.member_count = g.get("member_count", 0)
                    existing.is_active = True
                    existing.last_sync = now
                else:
                    guild = Guild(
                        discord_id=discord_id,
                        name=g.get("name", "Unknown"),
                        icon=g.get("icon"),
                        member_count=g.get("member_count", 0),
                        is_active=True,
                        last_sync=now,
                    )
                    db.session.add(guild)
                updated += 1

            db.session.commit()
            log.info("Guild sync complete — %d guilds upserted", updated)

            # Cache public guild count
            r.setex("hub:public:guild_count", 300, updated)

    except Exception as e:
        log.error("Guild sync failed: %s", e)


def sync_bot_stats() -> None:
    """Cache key bot stats for fast public API access."""
    raw = r.get(BOT_STATE_KEY)
    if not raw:
        return
    try:
        data = json.loads(raw)
        stats = data.get("stats", data)
        r.setex("hub:public:stats", 60, json.dumps({
            "servers": stats.get("servers", 0),
            "users": stats.get("users", 0),
            "status": stats.get("status", "offline"),
            "version": stats.get("version", "unknown"),
            "latency_ms": stats.get("latency_ms", 0),
        }))
    except Exception as e:
        log.warning("Failed to sync bot stats: %s", e)


def heartbeat() -> None:
    r.setex("hub:worker:heartbeat", 120, datetime.now(timezone.utc).isoformat())
    log.debug("Heartbeat written")


# ── Schedule ─────────────────────────────────────────────────────

schedule.every(30).seconds.do(sync_guilds)
schedule.every(15).seconds.do(sync_bot_stats)
schedule.every(60).seconds.do(heartbeat)


if __name__ == "__main__":
    log.info("Dissident Central Hub worker started")
    heartbeat()
    # Run immediately on startup
    sync_guilds()
    sync_bot_stats()
    while True:
        schedule.run_pending()
        time.sleep(5)

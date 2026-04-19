"""
Background worker — runs scheduled tasks for the Hub.
Start with: python -m worker.scheduler
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

import redis
import schedule

# Add project root to path so we can import dashboard models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    """Read guild list from bot Redis state and upsert into hub_guilds table."""
    raw = r.get(BOT_STATE_KEY)
    if not raw:
        log.debug("No bot state in Redis yet")
        return

    try:
        data = json.loads(raw)
    except Exception as exc:
        log.warning("Could not parse bot state: %s", exc)
        return

    guilds = data.get("guilds", [])
    stats = data.get("stats", {})
    if not guilds:
        log.debug("No guilds in bot state")
        return

    # Import Flask app context for DB access
    try:
        from dashboard.app import create_app
        from dashboard.extensions import db
        from dashboard.models import Guild

        app = create_app()
        with app.app_context():
            now = datetime.now(timezone.utc)
            synced = 0
            for g in guilds:
                discord_id = str(g.get("id", ""))
                name = g.get("name", "")
                if not discord_id or not name:
                    continue

                existing = Guild.query.filter_by(discord_id=discord_id).first()
                if existing:
                    existing.name = name
                    existing.icon = g.get("icon")
                    existing.member_count = g.get("member_count", 0)
                    existing.last_sync = now
                    existing.is_active = True
                else:
                    new_guild = Guild(
                        discord_id=discord_id,
                        name=name,
                        icon=g.get("icon"),
                        member_count=g.get("member_count", 0),
                        last_sync=now,
                        is_active=True,
                    )
                    db.session.add(new_guild)
                synced += 1

            # Mark guilds no longer in bot list as inactive
            current_ids = {str(g.get("id", "")) for g in guilds}
            for stale in Guild.query.filter_by(is_active=True).all():
                if stale.discord_id not in current_ids:
                    stale.is_active = False

            db.session.commit()
            log.info("Guild sync: %d guilds upserted", synced)
    except Exception as exc:
        log.error("Guild sync failed: %s", exc, exc_info=True)


def cache_public_stats() -> None:
    """Cache public-facing bot stats for the homepage widget."""
    raw = r.get(BOT_STATE_KEY)
    if not raw:
        return
    try:
        data = json.loads(raw)
        stats = data.get("stats", data)
        r.setex("hub:public:stats", 300, json.dumps({
            "servers": stats.get("servers", 0),
            "users": stats.get("users", 0),
            "status": stats.get("status", "offline"),
            "version": stats.get("version", "unknown"),
            "latency_ms": stats.get("latency_ms", 0),
        }))
    except Exception as exc:
        log.warning("Failed to cache public stats: %s", exc)


def heartbeat() -> None:
    r.setex("hub:worker:heartbeat", 120, datetime.now(timezone.utc).isoformat())
    log.debug("Heartbeat written")


def listen_for_commands() -> None:
    """
    Non-blocking check for any hub admin commands that need handling.
    Commands from the hub that the worker processes directly
    (bot-side command forwarding is handled by the bot's hub_sync cog).
    """
    pass


# ── Schedule ─────────────────────────────────────────────────────

schedule.every(30).seconds.do(sync_guilds)
schedule.every(30).seconds.do(cache_public_stats)
schedule.every(60).seconds.do(heartbeat)


if __name__ == "__main__":
    log.info("Dissident Central Hub worker started")
    heartbeat()
    # Run immediately on startup
    sync_guilds()
    cache_public_stats()
    while True:
        schedule.run_pending()
        time.sleep(5)

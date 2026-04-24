"""
Sloth Lee Command Hub — Background Worker
Runs guild sync, bot stats cache, and heartbeat tasks.
Start: python -m worker.scheduler
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import redis
import schedule

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("hub.worker")

# Redis connection
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
r = redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=5)

BOT_STATE_KEY = "dissident:bot_state"


def get_flask_app():
    """Lazy import Flask app to avoid circular imports."""
    os.environ.setdefault("SECRET_KEY", "worker-secret")
    from dashboard.app import create_app
    return create_app()


def sync_guilds() -> None:
    """Sync guild list from Redis bot state into hub Postgres."""
    try:
        raw = r.get(BOT_STATE_KEY)
        if not raw:
            log.debug("No bot state in Redis — skipping guild sync")
            return

        data = json.loads(raw)
        guilds = data.get("guilds", [])
        if not guilds:
            log.debug("Bot state has no guild list yet")
            return

        app = get_flask_app()
        with app.app_context():
            from dashboard.extensions import db
            from dashboard.models import Guild, GuildSettings

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
                    existing.channel_count = g.get("channel_count", existing.channel_count or 0)
                    existing.owner_discord_id = str(g.get("owner_id", "") or "") or existing.owner_discord_id
                    existing.is_active = True
                    existing.last_sync = now
                else:
                    guild = Guild(
                        discord_id=discord_id,
                        name=g.get("name", "Unknown"),
                        icon=g.get("icon"),
                        owner_discord_id=str(g.get("owner_id", "") or "") or None,
                        member_count=g.get("member_count", 0),
                        channel_count=g.get("channel_count", 0),
                        is_active=True,
                        last_sync=now,
                    )
                    db.session.add(guild)
                    db.session.flush()
                    # Create default settings
                    if not guild.settings:
                        settings = GuildSettings(guild_id=guild.id)
                        db.session.add(settings)
                updated += 1

            # Mark guilds not in the bot state as inactive
            active_ids = [str(g.get("id", "")) for g in guilds if g.get("id")]
            if active_ids:
                stale = Guild.query.filter(
                    Guild.discord_id.notin_(active_ids),
                    Guild.is_active == True  # noqa
                ).all()
                for g in stale:
                    g.is_active = False
                    log.info("Marked guild inactive: %s", g.name)

            db.session.commit()
            log.info("Guild sync: %d guilds upserted", updated)
            r.setex("hub:worker:last_guild_sync", 300, now.isoformat())

    except Exception as e:
        log.error("Guild sync failed: %s", e, exc_info=True)


def cache_bot_stats() -> None:
    """Cache key bot stats for fast public API access."""
    try:
        raw = r.get(BOT_STATE_KEY)
        if not raw:
            return
        data = json.loads(raw)
        stats = data.get("stats", data)
        r.setex("hub:public:stats", 60, json.dumps({
            "servers": stats.get("servers", 0),
            "users": stats.get("users", 0),
            "status": stats.get("status", "offline"),
            "version": stats.get("version", "unknown"),
            "latency_ms": stats.get("latency_ms", 0),
            "cogs_loaded": stats.get("cogs_loaded", 0),
        }))
    except Exception as e:
        log.warning("Stats cache failed: %s", e)


def heartbeat() -> None:
    """Write worker heartbeat so hub can check if worker is alive."""
    try:
        r.setex("hub:worker:heartbeat", 120, datetime.now(timezone.utc).isoformat())
    except Exception as e:
        log.warning("Heartbeat failed: %s", e)


# ── Schedule ──────────────────────────────────────────────────────

schedule.every(30).seconds.do(sync_guilds)
schedule.every(15).seconds.do(cache_bot_stats)
schedule.every(60).seconds.do(heartbeat)


def main():
    log.info("Sloth Lee Command Hub worker starting...")

    # Verify Redis connection
    try:
        r.ping()
        log.info("Redis connected: %s", redis_url.split("@")[-1] if "@" in redis_url else redis_url)
    except Exception as e:
        log.error("Redis connection failed: %s — exiting", e)
        sys.exit(1)

    # Run immediately on startup
    heartbeat()
    cache_bot_stats()
    sync_guilds()

    log.info("Worker started — running scheduled tasks")
    while True:
        schedule.run_pending()
        time.sleep(5)


if __name__ == "__main__":
    main()

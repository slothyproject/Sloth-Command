"""
Dissident Bot — discord.py entry point with modular cog loading and Redis state sync.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import discord
from discord.ext import commands, tasks
import redis

log = logging.getLogger("dissident")
log.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
log.addHandler(handler)

# ── Config ─────────────────────────────────────────────────────────

COMMAND_PREFIX = os.environ.get("BOT_PREFIX", "!")
OWNER_IDS = {int(i) for i in os.environ.get("DISCORD_OWNER_IDS", "").split(",") if i.strip()}

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

try:
    _redis = redis.from_url(REDIS_URL, decode_responses=True)
    _redis.ping()
    log.info("Redis connected")
except Exception as exc:
    log.warning("Redis unavailable: %s", exc)
    _redis = None

# ── Bot class ──────────────────────────────────────────────────────

intents = discord.Intents.default()
intents.members = True
intents.message_content = True
intents.guilds = True
intents.voice_states = True


class DissidentBot(commands.Bot):
    def __init__(self) -> None:
        super().__init__(
            command_prefix=self._get_prefix,
            intents=intents,
            owner_ids=OWNER_IDS,
            case_insensitive=True,
            help_command=None,
        )
        self.startup_time: datetime
        self.cog_list: list[str] = []
        self._command_count_today: int = 0

    @staticmethod
    def _get_prefix(bot: commands.Bot, message: discord.Message) -> str | list[str]:
        return commands.when_mentioned_or(COMMAND_PREFIX)(bot, message)

    async def setup_hook(self) -> None:
        self.startup_time = datetime.now(timezone.utc)
        await self._load_cogs()
        self._state_loop.start()
        self._redis_sub.start()
        log.info("Setup hook complete")

    async def _load_cogs(self) -> None:
        cogs_dir = Path(__file__).with_name("cogs")
        for path in sorted(cogs_dir.glob("*.py")):
            if path.name.startswith("_"):
                continue
            name = f"bot.cogs.{path.stem}"
            try:
                await self.load_extension(name)
                self.cog_list.append(path.stem)
                log.info("Cog loaded: %s", path.stem)
            except Exception as exc:
                log.warning("Cog load failed: %s — %s", path.stem, exc)

    async def on_ready(self) -> None:
        log.info("Logged in as %s (ID: %s)", self.user, self.user.id)
        log.info("Guilds: %d | Users: %d | Cogs: %d",
                 len(self.guilds), sum(g.member_count or 0 for g in self.guilds), len(self.cog_list))
        await self._sync_state()

    async def on_command_completion(self, ctx: commands.Context) -> None:
        self._command_count_today += 1

    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError) -> None:
        if isinstance(error, commands.NotOwner):
            return
        if isinstance(error, commands.CommandNotFound):
            return
        log.warning("Command error in %s: %s", ctx.command, error)

    @tasks.loop(seconds=2)
    async def _state_loop(self) -> None:
        await self._sync_state()

    @tasks.loop(count=1)
    async def _redis_sub(self) -> None:
        if _redis is None:
            return
        pubsub = _redis.pubsub()
        pubsub.subscribe("hub:commands")
        log.info("Redis pubsub listening on hub:commands")
        try:
            for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    await self._handle_hub_command(data)
                except Exception as exc:
                    log.warning("Hub command error: %s", exc)
        except Exception as exc:
            log.warning("Redis pubsub ended: %s", exc)

    async def _handle_hub_command(self, data: dict) -> None:
        cmd = data.get("command")
        payload = data.get("payload", {})
        action = payload.get("action", "")
        if cmd == "reload_config":
            log.info("Reloading config from hub command")
        elif cmd == "sync_guilds":
            for guild in self.guilds:
                await self._sync_guild_state(guild)
        elif cmd == "moderation_action":
            await self._run_action(action, payload)
        elif cmd == "voice_action":
            await self._run_voice_action(action, payload)
        elif cmd == "role_action":
            await self._run_role_action(action, payload)
        elif cmd == "channel_action":
            await self._run_channel_action(action, payload)
        elif cmd == "message_action":
            await self._run_message_action(action, payload)
        elif cmd == "emoji_action":
            await self._run_emoji_action(action, payload)

    async def _sync_state(self) -> None:
        if _redis is None:
            return
        now = datetime.now(timezone.utc)
        uptime = now - self.startup_time
        state = {
            "online": True,
            "status": "online",
            "guild_count": len(self.guilds),
            "member_count": sum(g.member_count or 0 for g in self.guilds),
            "channel_count": sum(len(g.channels) for g in self.guilds),
            "commands_today": self._command_count_today,
            "command_count": self._command_count_today,
            "uptime": str(uptime).split(".")[0] if uptime else "0:00:00",
            "uptime_seconds": int(uptime.total_seconds()),
            "latency_ms": round(self.latency * 1000, 1),
            "cog_count": len(self.cog_list),
            "version": "2.12.0",
            "updated_at": now.isoformat(),
            "guilds": [{"id": str(g.id), "name": g.name, "members": g.member_count or 0} for g in self.guilds],
            "commands": self.cog_list,
        }
        try:
            _redis.set("dissident:bot_state", json.dumps(state))
        except Exception as exc:
            log.warning("State sync failed: %s", exc)

    async def _sync_guild_state(self, guild: discord.Guild) -> None:
        pass

    async def _run_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        uid = int(payload.get("userId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        reason = payload.get("reason", "Dashboard action")
        try:
            if action == "ban":
                user = await self.fetch_user(uid)
                await guild.ban(user, reason=reason, delete_message_days=payload.get("deleteMessages", 0))
            else:
                member = guild.get_member(uid)
                if not member:
                    return
                if action == "kick":
                    await member.kick(reason=reason)
                elif action == "mute":
                    until = datetime.now(timezone.utc) + timedelta(seconds=payload.get("duration", 3600))
                    await member.timeout(until, reason=reason)
                elif action == "unmute":
                    await member.timeout(None, reason=reason)
            log.info("Action %s on user %s in guild %s", action, uid, gid)
        except Exception as exc:
            log.warning("Action %s failed: %s", action, exc)

    async def _run_voice_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        if action == "join":
            ch = guild.get_channel(int(payload.get("channelId", 0)))
            if ch and isinstance(ch, discord.VoiceChannel):
                await ch.connect()
        elif action == "leave":
            vc = guild.voice_client
            if vc:
                await vc.disconnect()
        elif action == "move":
            uid = int(payload.get("userId", 0))
            member = guild.get_member(uid)
            ch = guild.get_channel(int(payload.get("channelId", 0)))
            if member and ch and isinstance(ch, discord.VoiceChannel):
                await member.move_to(ch)

    async def _run_role_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        rid = int(payload.get("roleId", 0))
        reason = payload.get("reason", "Dashboard action")
        if action == "assign":
            member = guild.get_member(int(payload.get("userId", 0)))
            role = guild.get_role(rid)
            if member and role:
                await member.add_roles(role, reason=reason)
        elif action == "remove":
            member = guild.get_member(int(payload.get("userId", 0)))
            role = guild.get_role(rid)
            if member and role:
                await member.remove_roles(role, reason=reason)
        elif action == "create":
            await guild.create_role(name=payload.get("roleName", "New Role"), reason=reason)
        elif action == "delete":
            role = guild.get_role(rid)
            if role:
                await role.delete(reason=reason)

    async def _run_channel_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        reason = payload.get("reason", "Dashboard action")
        if action == "create":
            name = payload.get("name", "new-channel")
            if payload.get("type", "text") == "text":
                await guild.create_text_channel(name, reason=reason)
            else:
                await guild.create_voice_channel(name, reason=reason)
        elif action == "delete":
            ch = guild.get_channel(int(payload.get("channelId", 0)))
            if ch:
                await ch.delete(reason=reason)
        elif action == "rename":
            ch = guild.get_channel(int(payload.get("channelId", 0)))
            if ch:
                await ch.edit(name=payload.get("name", ch.name), reason=reason)

    async def _run_message_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        ch = guild.get_channel(int(payload.get("channelId", 0)))
        if not ch or not isinstance(ch, discord.TextChannel):
            return
        reason = payload.get("reason", "Dashboard action")
        if action == "bulk_delete":
            await ch.purge(limit=payload.get("limit", 100), reason=reason)
        elif action == "pin":
            msg = await ch.fetch_message(int(payload.get("messageId", 0)))
            if msg:
                await msg.pin(reason=reason)
        elif action == "unpin":
            msg = await ch.fetch_message(int(payload.get("messageId", 0)))
            if msg:
                await msg.unpin(reason=reason)
        elif action == "send":
            await ch.send(payload.get("content", ""))

    async def _run_emoji_action(self, action: str, payload: dict) -> None:
        gid = int(payload.get("guildId", 0))
        guild = self.get_guild(gid)
        if not guild:
            return
        if action == "remove":
            emoji = discord.utils.get(guild.emojis, name=payload.get("name", ""))
            if emoji:
                await emoji.delete(reason=payload.get("reason", "Dashboard action"))


# ── Entry point ────────────────────────────────────────────────────

def main() -> None:
    token = os.environ.get("DISSIDENT_TOKEN") or os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        log.error("DISCORD_BOT_TOKEN environment variable is required")
        sys.exit(1)
    bot = DissidentBot()
    try:
        bot.run(token, log_handler=None)
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        if _redis:
            try:
                _redis.set("dissident:bot_state", json.dumps({"online": False, "status": "offline"}))
            except Exception:
                pass


if __name__ == "__main__":
    main()

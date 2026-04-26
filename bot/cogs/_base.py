"""Base cog utilities shared across Dissident cogs."""
from __future__ import annotations

import asyncio
import logging
from typing import Any

import discord
from discord.ext import commands

log = logging.getLogger("dissident")


def safe_send(ctx, content: str = None, *, embed: discord.Embed = None, delete_after: int = None):
    """Safely send a message or embed with basic error handling."""
    try:
        return ctx.send(content=content, embed=embed, delete_after=delete_after)
    except Exception as exc:
        log.warning("safe_send failed: %s", exc)


def format_duration(seconds: int) -> str:
    """Format seconds into a human-readable duration string."""
    units = [("d", 86400), ("h", 3600), ("m", 60), ("s", 1)]
    parts = []
    remaining = seconds
    for suffix, value in units:
        if remaining >= value:
            count = remaining // value
            parts.append(f"{count}{suffix}")
            remaining %= value
    return " ".join(parts) if parts else "0s"


class ModActionLogMixin:
    """Mixin for cogs that need to post mod actions to a log channel."""

    async def log_action(self, ctx: commands.Context, action: str, target: discord.Member | discord.User | str, *, reason: str = None, before_after: dict = None) -> None:
        guild = ctx.guild
        if not guild:
            return
        # Stub: read log_channel from guild settings in DB
        # For now, attempt to find channel named 'mod-logs' or similar
        log_channel = discord.utils.get(guild.text_channels, name="mod-logs") or discord.utils.get(guild.text_channels, name="logs")
        if not log_channel:
            return
        embed = discord.Embed(title=f"{action}", color=0xE74C3C, timestamp=discord.utils.utcnow())
        embed.add_field(name="Target", value=target.mention if hasattr(target, "mention") else str(target), inline=True)
        embed.add_field(name="Moderator", value=ctx.author.mention, inline=True)
        if reason:
            embed.add_field(name="Reason", value=reason[:1024], inline=False)
        if before_after:
            for key, value in before_after.items():
                embed.add_field(name=key, value=value, inline=True)
        embed.set_footer(text=f"ID: {getattr(target, 'id', 'N/A')}")
        try:
            await log_channel.send(embed=embed)
        except Exception:
            pass


class ReactionConfirm:
    """Helper to get yes/no confirmation via reactions."""

    def __init__(self, ctx: commands.Context, message: discord.Message, timeout: float = 30.0):
        self.ctx = ctx
        self.message = message
        self.timeout = timeout
        self.confirmed: bool | None = None

    async def ask(self) -> bool | None:
        for emoji in ("✅", "❌"):
            try:
                await self.message.add_reaction(emoji)
            except Exception:
                pass
        def check(reaction, user):
            return user == self.ctx.author and reaction.message.id == self.message.id and str(reaction.emoji) in ("✅", "❌")
        try:
            reaction, user = await self.ctx.bot.wait_for("reaction_add", timeout=self.timeout, check=check)
            self.confirmed = str(reaction.emoji) == "✅"
            return self.confirmed
        except asyncio.TimeoutError:
            return None

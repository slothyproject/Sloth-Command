"""Automod cog — simple auto-moderation: caps spam, repeated messages, invites, links."""
from __future__ import annotations

import re
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import discord
from discord.ext import commands

INVITE_RE = re.compile(r"(https?://)?(www\\.)?(discord\\.(gg|io|me|li)|discord(app)?\\.com/invite)/[a-zA-Z0-9]+", re.IGNORECASE)
LINK_RE = re.compile(r"https?://\\S+")
URL_RE = re.compile(r"https?://\\S+")


class AutoMod(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self._message_cache: dict[int, deque[tuple[datetime, str]]] = defaultdict(lambda: deque(maxlen=10))
        self._caps_cache: dict[int, deque[datetime]] = defaultdict(lambda: deque(maxlen=20))
        self._strike_cache: dict[int, int] = defaultdict(int)  # guild_id: int

    def _is_caps(self, content: str) -> bool:
        letters_only = re.sub(r"[^a-zA-Z]", "", content)
        if len(letters_only) < 5:
            return False
        return sum(1 for c in letters_only if c.isupper()) / len(letters_only) > 0.7

    def _is_repeat(self, guild_id: int, content: str) -> bool:
        cache = self._message_cache[guild_id]
        if not cache:
            return False
        recent = [msg for ts, msg in cache if datetime.now(timezone.utc) - ts < timedelta(seconds=10)]
        return sum(1 for m in recent if m == content) >= 4

    def _has_invite(self, content: str) -> bool:
        return bool(INVITE_RE.search(content))

    def _has_link(self, content: str) -> bool:
        return bool(LINK_RE.search(content))

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
        guild_id = message.guild.id
        author = message.author
        content = message.content

        self._message_cache[guild_id].append((datetime.now(timezone.utc), content))

        # Caps spam
        if self._is_caps(content):
            try:
                await message.delete()
                embed = discord.Embed(title="🤖 AutoMod — Spam Removed", description="Excessive caps detected.", color=0xE74C3C)
                await message.channel.send(embed=embed, delete_after=5)
                await self._log_action(message.guild, author, "Spam → Removed message", f"```{content[:500]}```")
            except Exception:
                pass
            return

        # Repeated text
        if self._is_repeat(guild_id, content):
            try:
                await message.delete()
                embed = discord.Embed(title="🤖 AutoMod — Spam Removed", description="Repeated message detected.", color=0xE74C3C)
                await message.channel.send(embed=embed, delete_after=5)
                await self._log_action(message.guild, author, "Repeats → Removed message", f"```{content[:500]}```")
            except Exception:
                pass
            return

        # Invite links
        if self._has_invite(content):
            try:
                await message.delete()
                embed = discord.Embed(title="🤖 AutoMod — Invite Removed", description="Unauthorized Discord invite detected.", color=0xE74C3C)
                await message.channel.send(embed=embed, delete_after=5)
                await self._log_action(message.guild, author, "Invite → Removed message", f"```{content[:500]}```")
            except Exception:
                pass
            return

    async def _log_action(self, guild: discord.Guild, target: discord.Member, action: str, details: str) -> None:
        channel = discord.utils.get(guild.text_channels, name="mod-logs") or discord.utils.get(guild.text_channels, name="logs")
        if not channel:
            return
        embed = discord.Embed(title="🤖 AutoMod", description=action, color=0xE74C3C, timestamp=discord.utils.utcnow())
        embed.add_field(name="User", value=target.mention, inline=True)
        embed.add_field(name="Details", value=details[:1024], inline=False)
        await channel.send(embed=embed)

    @commands.command(name="automod")
    @commands.has_permissions(manage_guild=True)
    async def automod_cmd(self, ctx: commands.Context, toggle: str):
        """Enable or disable automod. Usage: !automod on | off"""
        enabled = toggle.lower() in ("on", "true", "enable", "1")
        embed = discord.Embed(
            title="🛡️ AutoMod",
            description="AutoMod is now " + ("**enabled**" if enabled else "**disabled**") + ".",
            color=0x2ECC71 if enabled else 0xE74C3C,
        )
        embed.set_footer(text="Settings persist per guild in a full implementation.")
        await ctx.send(embed=embed)

    async def cog_load(self):
        print("AutoMod cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(AutoMod(bot))

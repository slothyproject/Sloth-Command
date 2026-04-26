"""Leveling cog — XP gain, ranks, rewards, leaderboard."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import discord
from discord.ext import commands


_DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "leveling.json"
_DATA_FILE.parent.mkdir(exist_ok=True)


def _load_data() -> dict:
    if _DATA_FILE.exists():
        return json.loads(_DATA_FILE.read_text())
    return {}


def _save_data(data: dict) -> None:
    _DATA_FILE.write_text(json.dumps(data, indent=2))


def _xp_for_level(level: int) -> int:
    return int(100 * math.pow(level, 1.8))


class Leveling(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self._data = _load_data()

    def _key(self, guild_id: int, user_id: int) -> str:
        return f"{guild_id}:{user_id}"

    def _ensure_user(self, guild_id: int, user_id: int):
        key = self._key(guild_id, user_id)
        if key not in self._data:
            self._data[key] = {"xp": 0, "total_xp": 0, "level": 1, "last_msg": None}
        return self._data[key]

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
        guild_id = message.guild.id
        user_id = message.author.id
        data = self._ensure_user(guild_id, user_id)
        now = datetime.now(timezone.utc)
        last = data.get("last_msg")
        if last:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if (now - last_dt).total_seconds() < 30:
                return
        data["last_msg"] = now.isoformat()
        # XP roll: 10-25 per message
        import random
        xp_gain = random.randint(10, 25)
        data["total_xp"] += xp_gain
        data["xp"] += xp_gain
        # Level up check
        required = _xp_for_level(data["level"])
        if data["xp"] >= required:
            data["level"] += 1
            data["xp"] -= required
            # Announce
            try:
                embed = discord.Embed(
                    title="🎉 Level Up!",
                    description=f"Congratulations {message.author.mention}, you reached **Level {data['level']}**!",
                    color=0xF1C40F,
                )
                embed.set_thumbnail(url=message.author.display_avatar.url)
                await message.channel.send(embed=embed)
            except Exception:
                pass
        _save_data(self._data)

    @commands.command(name="rank")
    async def rank_cmd(self, ctx: commands.Context, member: discord.Member = None):
        """Check your rank and XP."""
        target = member or ctx.author
        data = self._ensure_user(ctx.guild.id, target.id)
        required = _xp_for_level(data["level"])
        progress = int((data["xp"] / required) * 10)
        bar = "█" * progress + "░" * (10 - progress)
        embed = discord.Embed(title=f"📊 Rank — {target.display_name}", color=0x9B59B6)
        embed.add_field(name="Level", value=f"**{data['level']}**", inline=True)
        embed.add_field(name="XP", value=f"{data['xp']} / {required}", inline=True)
        embed.add_field(name="Total XP", value=f"{data['total_xp']}", inline=True)
        embed.add_field(name="Progress", value=f"`{bar}`", inline=False)
        embed.set_thumbnail(url=target.display_avatar.url)
        await ctx.send(embed=embed)

    @commands.command(name="levels")
    async def levels_cmd(self, ctx: commands.Context):
        """Show the top 10 members by level."""
        guild_id = ctx.guild.id
        entries = [(k, v) for k, v in self._data.items() if k.startswith(f"{guild_id}:")]
        entries.sort(key=lambda x: (x[1]["total_xp"]), reverse=True)
        embed = discord.Embed(title="🏆 Level Leaderboard", color=0xF1C40F)
        for i, (key, data) in enumerate(entries[:10], 1):
            user_id = int(key.split(":", 1)[1])
            member = ctx.guild.get_member(user_id)
            name = member.display_name if member else f"User {user_id}"
            embed.add_field(name=f"#{i} {name} — Lv.{data['level']}", value=f"XP: {data['total_xp']}", inline=False)
        if not entries:
            embed.description = "No leveling data yet. Start chatting to earn XP!"
        await ctx.send(embed=embed)

    async def cog_load(self):
        print("Leveling cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Leveling(bot))

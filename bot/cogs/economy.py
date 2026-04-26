"""Economy cog — work, balance, daily, pay, leaderboard."""
from __future__ import annotations

import json
import os
import random
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import discord
from discord.ext import commands


_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_DATA_DIR.mkdir(exist_ok=True)
_ECONOMY_FILE = _DATA_DIR / "economy.json"


def _load_economy() -> dict:
    if _ECONOMY_FILE.exists():
        return json.loads(_ECONOMY_FILE.read_text())
    return {}


def _save_economy(data: dict) -> None:
    _ECONOMY_FILE.write_text(json.dumps(data, indent=2))


class Economy(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self._data = _load_economy()

    def _user_key(self, guild_id: int, user_id: int) -> str:
        return f"{guild_id}:{user_id}"

    def _ensure_user(self, guild_id: int, user_id: int):
        key = self._user_key(guild_id, user_id)
        if key not in self._data:
            self._data[key] = {"balance": 0, "bank": 0, "last_daily": None, "streak": 0, "xp": 0, "level": 1}
        return self._data[key]

    @commands.command(name="balance")
    async def balance_cmd(self, ctx: commands.Context, member: discord.Member = None):
        """Check your or someone else's balance."""
        target = member or ctx.author
        data = self._ensure_user(ctx.guild.id, target.id)
        embed = discord.Embed(title="💰 Balance", color=0xF1C40F)
        embed.add_field(name="Wallet", value=f"**${data['balance']}**", inline=True)
        embed.add_field(name="Bank", value=f"**${data['bank']}**", inline=True)
        embed.add_field(name="Net Worth", value=f"**${data['balance'] + data['bank']}**", inline=True)
        embed.set_footer(text=f"Level {data['level']} | XP: {data['xp']}")
        await ctx.send(embed=embed)

    @commands.command(name="daily")
    async def daily_cmd(self, ctx: commands.Context):
        """Claim your daily reward."""
        data = self._ensure_user(ctx.guild.id, ctx.author.id)
        now = datetime.now(timezone.utc)
        last = data.get("last_daily")
        if last:
            last_dt = datetime.fromisoformat(last)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            if now - last_dt < timedelta(hours=20):
                remaining = timedelta(hours=20) - (now - last_dt)
                await ctx.send(f"⏳ You can claim again in **{remaining}**.", delete_after=10)
                return
        base = 200
        streak_bonus = min(data.get("streak", 0) * 10, 200)
        amount = base + streak_bonus
        data["balance"] += amount
        data["last_daily"] = now.isoformat()
        # streak logic: within 24h for streak
        if last and datetime.fromisoformat(last).replace(tzinfo=timezone.utc) + timedelta(hours=24) >= now:
            data["streak"] = data.get("streak", 0) + 1
        else:
            data["streak"] = 1
        _save_economy(self._data)
        embed = discord.Embed(title="💰 Daily Reward", description=f"You received **${amount}**!", color=0x2ECC71)
        embed.set_footer(text=f"Streak: {data['streak']} days | Next bonus: +${min(data['streak'] * 10, 200)}")
        await ctx.send(embed=embed)

    @commands.command(name="work")
    async def work_cmd(self, ctx: commands.Context):
        """Work and earn a small wage."""
        data = self._ensure_user(ctx.guild.id, ctx.author.id)
        jobs = ["developer", "barista", "streamer", "artist", "mechanic", "chef", "pilot", "musician"]
        job = random.choice(jobs)
        wage = random.randint(50, 150)
        data["balance"] += wage
        data["xp"] += random.randint(5, 15)
        _save_economy(self._data)
        embed = discord.Embed(
            title="💼 Work",
            description=f"You worked as a **{job}** and earned **${wage}**.",
            color=0x3498DB,
        )
        await ctx.send(embed=embed)

    @commands.command(name="pay")
    async def pay_cmd(self, ctx: commands.Context, member: discord.Member, amount: int):
        """Pay someone from your wallet."""
        if amount <= 0:
            await ctx.send("Amount must be positive.", delete_after=5)
            return
        sender = self._ensure_user(ctx.guild.id, ctx.author.id)
        if sender["balance"] < amount:
            await ctx.send("You don't have enough money.", delete_after=5)
            return
        receiver = self._ensure_user(ctx.guild.id, member.id)
        sender["balance"] -= amount
        receiver["balance"] += amount
        _save_economy(self._data)
        embed = discord.Embed(title="💸 Payment", description=f"{ctx.author.mention} paid {member.mention} **${amount}**.", color=0x2ECC71)
        await ctx.send(embed=embed)

    @commands.command(name="leaderboard")
    async def leaderboard_cmd(self, ctx: commands.Context):
        """Show the top 10 richest members."""
        guild_id = ctx.guild.id
        guild_users = [(k, v) for k, v in self._data.items() if k.startswith(f"{guild_id}:")]
        guild_users.sort(key=lambda x: x[1]["balance"] + x[1]["bank"], reverse=True)
        embed = discord.Embed(title="🏆 Economy Leaderboard", color=0xF1C40F)
        for i, (key, data) in enumerate(guild_users[:10], 1):
            user_id = int(key.split(":", 1)[1])
            member = ctx.guild.get_member(user_id)
            name = member.display_name if member else f"User {user_id}"
            net = data["balance"] + data["bank"]
            embed.add_field(name=f"#{i} {name}", value=f"${net}", inline=False)
        if not guild_users:
            embed.description = "No economy data yet."
        await ctx.send(embed=embed)

    @commands.command(name="deposit")
    async def deposit_cmd(self, ctx: commands.Context, amount: int):
        """Deposit money into your bank."""
        data = self._ensure_user(ctx.guild.id, ctx.author.id)
        amount = min(amount, data["balance"])
        if amount <= 0:
            await ctx.send("Invalid amount.", delete_after=5)
            return
        data["balance"] -= amount
        data["bank"] += amount
        _save_economy(self._data)
        await ctx.send(f"🏦 Deposited **${amount}** into your bank.")

    @commands.command(name="withdraw")
    async def withdraw_cmd(self, ctx: commands.Context, amount: int):
        """Withdraw money from your bank."""
        data = self._ensure_user(ctx.guild.id, ctx.author.id)
        amount = min(amount, data["bank"])
        if amount <= 0:
            await ctx.send("Invalid amount.", delete_after=5)
            return
        data["bank"] -= amount
        data["balance"] += amount
        _save_economy(self._data)
        await ctx.send(f"💵 Withdrew **${amount}** from your bank.")

    async def cog_load(self):
        print("Economy cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Economy(bot))

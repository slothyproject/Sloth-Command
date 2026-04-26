"""Utility cog — avatar, serverinfo, userinfo, ping, uptime, remind."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import discord
from discord.ext import commands


class Utility(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="ping")
    async def ping_cmd(self, ctx: commands.Context):
        """Check bot latency."""
        latency = round(self.bot.latency * 1000, 1)
        embed = discord.Embed(title="🏓 Pong!", description=f"Latency: **{latency}ms**", color=0x2ECC71)
        await ctx.send(embed=embed)

    @commands.command(name="uptime")
    async def uptime_cmd(self, ctx: commands.Context):
        """Check how long the bot has been running."""
        if hasattr(self.bot, "startup_time"):
            delta = datetime.now(timezone.utc) - self.bot.startup_time
            uptime_str = str(delta).split(".")[0]
        else:
            uptime_str = "Unknown"
        embed = discord.Embed(title="⏱️ Uptime", description=f"**{uptime_str}**", color=0x3498DB)
        await ctx.send(embed=embed)

    @commands.command(name="avatar")
    async def avatar_cmd(self, ctx: commands.Context, member: discord.Member = None):
        """Get a user's avatar."""
        target = member or ctx.author
        embed = discord.Embed(title=f"{target.display_name}'s Avatar", color=0x9B59B6)
        embed.set_image(url=target.display_avatar.url)
        await ctx.send(embed=embed)

    @commands.command(name="userinfo")
    async def userinfo_cmd(self, ctx: commands.Context, member: discord.Member = None):
        """Get detailed info about a user."""
        target = member or ctx.author
        embed = discord.Embed(title=f"👤 User Info — {target.display_name}", color=0x3498DB)
        embed.add_field(name="ID", value=target.id, inline=True)
        embed.add_field(name="Username", value=str(target), inline=True)
        embed.add_field(name="Bot?", value="Yes" if target.bot else "No", inline=True)
        embed.add_field(name="Joined Server", value=target.joined_at.strftime("%Y-%m-%d"), inline=True)
        embed.add_field(name="Account Created", value=target.created_at.strftime("%Y-%m-%d"), inline=True)
        embed.add_field(name="Roles", value=", ".join(r.mention for r in target.roles[1:][:10]) or "None", inline=False)
        embed.set_thumbnail(url=target.display_avatar.url)
        embed.set_footer(text=f"Requested by {ctx.author}")
        await ctx.send(embed=embed)

    @commands.command(name="serverinfo")
    async def serverinfo_cmd(self, ctx: commands.Context):
        """Get detailed info about the server."""
        guild = ctx.guild
        embed = discord.Embed(title=f"🏠 Server Info — {guild.name}", color=0x2ECC71)
        embed.add_field(name="ID", value=guild.id, inline=True)
        embed.add_field(name="Owner", value=guild.owner.mention if guild.owner else "Unknown", inline=True)
        embed.add_field(name="Members", value=guild.member_count or "?", inline=True)
        embed.add_field(name="Channels", value=len(guild.channels), inline=True)
        embed.add_field(name="Roles", value=len(guild.roles), inline=True)
        embed.add_field(name="Boosts", value=guild.premium_subscription_count or 0, inline=True)
        embed.add_field(name="Created", value=guild.created_at.strftime("%Y-%m-%d"), inline=True)
        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
        await ctx.send(embed=embed)

    @commands.command(name="remind")
    async def remind_cmd(self, ctx: commands.Context, minutes: int, *, text: str):
        """Set a reminder for N minutes."""
        await ctx.send(f"⏰ Reminder set for **{minutes}** minutes.")
        await asyncio.sleep(minutes * 60)
        embed = discord.Embed(title="⏰ Reminder", description=text, color=0xF1C40F)
        embed.set_footer(text=f"Set by {ctx.author}")
        await ctx.send(content=ctx.author.mention, embed=embed)

    async def cog_load(self):
        print("Utility cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Utility(bot))

"""Moderation cog — warn, mute, kick, ban, unban, purge, slowmode, lock, unlock."""
from __future__ import annotations

import asyncio

import discord
from discord.ext import commands

from bot.cogs._base import format_duration, ModActionLogMixin


class Moderation(commands.Cog, ModActionLogMixin):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="warn")
    @commands.has_permissions(manage_messages=True)
    async def warn_cmd(self, ctx: commands.Context, member: discord.Member, *, reason: str = "No reason provided"):
        """Warn a member."""
        embed = discord.Embed(title="⚠️ Warning", color=0xF39C12, timestamp=discord.utils.utcnow())
        embed.description = f"{member.mention} has been warned."
        embed.add_field(name="Reason", value=reason[:1024], inline=False)
        embed.add_field(name="Moderator", value=ctx.author.mention, inline=True)
        await ctx.send(embed=embed)
        await self.log_action(ctx, "Warn", member, reason=reason)

    @commands.command(name="mute")
    @commands.has_permissions(moderate_members=True)
    async def mute_cmd(self, ctx: commands.Context, member: discord.Member, duration: int = 3600, *, reason: str = "No reason provided"):
        """Timeout a member for N seconds (default 1h)."""
        until = discord.utils.utcnow() + discord.utils.timezone.utc.__class__("utc").__class__
        # Build timedelta manually to avoid import issues
        import datetime
        until = discord.utils.utcnow() + datetime.timedelta(seconds=duration)
        await member.timeout(until, reason=reason)
        embed = discord.Embed(title="🔇 Muted", color=0xE74C3C, timestamp=discord.utils.utcnow())
        embed.description = f"{member.mention} muted for **{format_duration(duration)}**."
        embed.add_field(name="Reason", value=reason[:1024], inline=False)
        await ctx.send(embed=embed)
        await self.log_action(ctx, "Mute", member, reason=reason)

    @commands.command(name="unmute")
    @commands.has_permissions(moderate_members=True)
    async def unmute_cmd(self, ctx: commands.Context, member: discord.Member, *, reason: str = "No reason provided"):
        """Remove timeout from a member."""
        await member.timeout(None, reason=reason)
        await ctx.send(f"🔊 {member.mention} has been unmuted.")
        await self.log_action(ctx, "Unmute", member, reason=reason)

    @commands.command(name="kick")
    @commands.has_permissions(kick_members=True)
    async def kick_cmd(self, ctx: commands.Context, member: discord.Member, *, reason: str = "No reason provided"):
        """Kick a member from the server."""
        await member.kick(reason=reason)
        await ctx.send(f"👢 {member.mention} has been kicked.\n**Reason:** {reason}")
        await self.log_action(ctx, "Kick", member, reason=reason)

    @commands.command(name="ban")
    @commands.has_permissions(ban_members=True)
    async def ban_cmd(self, ctx: commands.Context, member: commands.MemberConverter, *, reason: str = "No reason provided"):
        """Ban a member by mention or ID."""
        await ctx.guild.ban(member, reason=reason, delete_message_days=0)
        await ctx.send(f"🔨 {member.mention} has been banned.\n**Reason:** {reason}")
        await self.log_action(ctx, "Ban", member, reason=reason)

    @commands.command(name="unban")
    @commands.has_permissions(ban_members=True)
    async def unban_cmd(self, ctx: commands.Context, user_id: int, *, reason: str = "No reason provided"):
        """Unban a user by ID."""
        user = discord.Object(id=user_id)
        await ctx.guild.unban(user, reason=reason)
        await ctx.send(f"🔨 User with ID `{user_id}` has been unbanned.")
        await self.log_action(ctx, "Unban", str(user_id), reason=reason)

    @commands.command(name="purge")
    @commands.has_permissions(manage_messages=True)
    async def purge_cmd(self, ctx: commands.Context, limit: int = 100):
        """Purge messages from the channel (max 1000)."""
        limit = max(1, min(limit, 1000))
        deleted = await ctx.channel.purge(limit=limit + 1)
        msg = await ctx.send(f"🧹 Purged **{len(deleted) - 1}** messages.")
        await asyncio.sleep(3)
        await msg.delete()

    @commands.command(name="slowmode")
    @commands.has_permissions(manage_channels=True)
    async def slowmode_cmd(self, ctx: commands.Context, seconds: int = 0):
        """Set slowmode in the channel (0 to disable)."""
        await ctx.channel.edit(slowmode_delay=seconds)
        if seconds:
            await ctx.send(f"🐌 Slowmode set to **{seconds}s**.")
        else:
            await ctx.send("✅ Slowmode disabled.")

    @commands.command(name="lock")
    @commands.has_permissions(manage_channels=True)
    async def lock_cmd(self, ctx: commands.Context, channel: discord.TextChannel = None):
        """Lock a channel so @everyone cannot send messages."""
        target = channel or ctx.channel
        await target.set_permissions(ctx.guild.default_role, send_messages=False)
        await ctx.send(f"🔒 {target.mention} has been locked.")

    @commands.command(name="unlock")
    @commands.has_permissions(manage_channels=True)
    async def unlock_cmd(self, ctx: commands.Context, channel: discord.TextChannel = None):
        """Unlock a channel."""
        target = channel or ctx.channel
        await target.set_permissions(ctx.guild.default_role, send_messages=None)
        await ctx.send(f"🔓 {target.mention} has been unlocked.")

    async def cog_load(self):
        print("Moderation cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))

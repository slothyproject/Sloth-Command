"""Tickets cog — create, close, assign, transcript, priority."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import discord
from discord.ext import commands

from bot.cogs._base import format_duration


class Tickets(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.active_tickets: dict[int, dict] = {}  # guild_id -> {channel_id: opener_id}

    @commands.command(name="ticket")
    @commands.guild_only()
    async def ticket_cmd(self, ctx: commands.Context, *, subject: str = "Support request"):
        """Open a support ticket."""
        guild = ctx.guild
        # Find/create ticket category
        category = discord.utils.get(guild.categories, name="Tickets") or guild.categories[0] if guild.categories else None
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            ctx.author: discord.PermissionOverwrite(read_messages=True, send_messages=True),
            guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True),
        }
        # Grant staff roles read access
        for role in guild.roles:
            if any(keyword in role.name.lower() for keyword in ("mod", "admin", "staff", "support")):
                overwrites[role] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
        channel = await guild.create_text_channel(
            name=f"ticket-{ctx.author.name}".lower()[:100],
            category=category,
            overwrites=overwrites,
            reason=f"Ticket opened by {ctx.author}"
        )
        self.active_tickets.setdefault(guild.id, {})[channel.id] = ctx.author.id
        embed = discord.Embed(
            title="🎫 Ticket Opened",
            description=f"Hi {ctx.author.mention}, staff will be with you shortly.\n\n**Subject:** {subject}",
            color=0x2ECC71,
            timestamp=datetime.now(timezone.utc),
        )
        embed.set_footer(text=f"ID: {channel.id}")
        msg = await channel.send(embed=embed)
        await msg.pin()
        await ctx.send(f"✅ Ticket created: {channel.mention}", delete_after=10)

    @commands.command(name="close")
    @commands.has_permissions(manage_channels=True)
    async def close_cmd(self, ctx: commands.Context, *, reason: str = "Resolved"):
        """Close the current ticket channel."""
        guild_id = ctx.guild.id
        if guild_id not in self.active_tickets or ctx.channel.id not in self.active_tickets[guild_id]:
            await ctx.send("This is not a ticket channel.", delete_after=5)
            return
        embed = discord.Embed(title="🎫 Ticket Closed", description=f"**Reason:** {reason}", color=0xE74C3C)
        embed.set_footer(text=f"Closed by {ctx.author}")
        await ctx.send(embed=embed)
        await asyncio.sleep(5)
        await ctx.channel.delete(reason=f"Ticket closed by {ctx.author}: {reason}")
        del self.active_tickets[guild_id][ctx.channel.id]

    @commands.command(name="transcript")
    @commands.has_permissions(manage_channels=True)
    async def transcript_cmd(self, ctx: commands.Context, limit: int = 100):
        """Generate a transcript of the channel."""
        messages = []
        async for msg in ctx.channel.history(limit=limit):
            messages.append(f"[{msg.created_at.isoformat()}] {msg.author}: {msg.content}")
        content = "\n".join(reversed(messages))
        if len(content) > 1900:
            from io import BytesIO
            file = discord.File(BytesIO(content.encode()), filename="transcript.txt")
            await ctx.send("📄 Transcript:", file=file)
        else:
            await ctx.send(f"📄 **Transcript** (last {limit})\n```\n{content[:1900]}\n```")

    async def cog_load(self):
        print("Tickets cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Tickets(bot))

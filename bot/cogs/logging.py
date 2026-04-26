"""Logging cog — message edits, deletions, role changes, nickname changes."""
from __future__ import annotations

import discord
from discord.ext import commands


class Logging(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def _log_channel(self, guild: discord.Guild) -> discord.TextChannel | None:
        # Prefer configured channel; fall back to "logs"
        return discord.utils.get(guild.text_channels, name="logs")

    async def _send_log(self, guild: discord.Guild, embed: discord.Embed) -> None:
        channel = self._log_channel(guild)
        if channel:
            try:
                await channel.send(embed=embed)
            except Exception:
                pass

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message):
        if message.author.bot:
            return
        if not message.guild:
            return
        embed = discord.Embed(title="🗑️ Message Deleted", color=0xE74C3C, timestamp=discord.utils.utcnow())
        embed.add_field(name="Author", value=message.author.mention, inline=True)
        embed.add_field(name="Channel", value=message.channel.mention, inline=True)
        embed.add_field(name="Content", value=message.content[:1024] or "*No text content*", inline=False)
        embed.set_footer(text=f"ID: {message.author.id}")
        await self._send_log(message.guild, embed)

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if before.author.bot or before.content == after.content:
            return
        if not before.guild:
            return
        embed = discord.Embed(title="✏️ Message Edited", color=0xF1C40F, timestamp=discord.utils.utcnow())
        embed.add_field(name="Author", value=before.author.mention, inline=True)
        embed.add_field(name="Channel", value=before.channel.mention, inline=True)
        embed.add_field(name="Before", value=before.content[:1024] or "*Empty*", inline=False)
        embed.add_field(name="After", value=after.content[:1024] or "*Empty*", inline=False)
        embed.set_footer(text=f"ID: {before.author.id}")
        await self._send_log(before.guild, embed)

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if not before.guild:
            return
        # Role changes
        if before.roles != after.roles:
            added = [r for r in after.roles if r not in before.roles and not r.is_default()]
            removed = [r for r in before.roles if r not in after.roles and not r.is_default()]
            if added or removed:
                embed = discord.Embed(title="🎭 Role Update", color=0x9B59B6, timestamp=discord.utils.utcnow())
                embed.add_field(name="Member", value=after.mention, inline=True)
                if added:
                    embed.add_field(name="Added", value=", ".join(r.mention for r in added), inline=False)
                if removed:
                    embed.add_field(name="Removed", value=", ".join(r.mention for r in removed), inline=False)
                embed.set_footer(text=f"ID: {after.id}")
                await self._send_log(after.guild, embed)
        # Nickname changes
        if before.nick != after.nick:
            embed = discord.Embed(title="🏷️ Nickname Changed", color=0x3498DB, timestamp=discord.utils.utcnow())
            embed.add_field(name="Member", value=after.mention, inline=True)
            embed.add_field(name="Before", value=before.nick or before.display_name, inline=True)
            embed.add_field(name="After", value=after.nick or after.display_name, inline=True)
            embed.set_footer(text=f"ID: {after.id}")
            await self._send_log(after.guild, embed)

    async def cog_load(self):
        print("Logging cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Logging(bot))

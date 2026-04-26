"""Welcome cog — automated welcome / farewell DMs and channel messages, plus auto-role."""
from __future__ import annotations

import random

import discord
from discord.ext import commands


DEFAULT_WELCOME_MESSAGES = [
    "Welcome to {server}, {user}! 🎉",
    "{user} just joined {server}. Make them feel at home! 👋",
    "A wild {user} appeared in {server}! 🐾",
    "Everyone welcome {user} to {server}! 🎊",
]

DEFAULT_GOODBYE_MESSAGES = [
    "{user} has left {server}. Farewell! 👋",
    "{user} departed from {server}. We'll miss you. 💔",
]


class Welcome(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        guild = member.guild
        # Welcome channel
        welcome_channel = discord.utils.get(guild.text_channels, name="welcome")
        if not welcome_channel and guild.system_channel:
            welcome_channel = guild.system_channel
        if welcome_channel:
            msg = random.choice(DEFAULT_WELCOME_MESSAGES).format(user=member.mention, server=guild.name)
            embed = discord.Embed(description=msg, color=0x2ECC71)
            embed.set_thumbnail(url=member.display_avatar.url)
            embed.set_footer(text=f"Member #{guild.member_count}")
            await welcome_channel.send(embed=embed)
        # Auto-role
        default_role = discord.utils.get(guild.roles, name="Member") or discord.utils.get(guild.roles, name="member")
        if default_role:
            try:
                await member.add_roles(default_role, reason="Auto-role on join")
            except Exception:
                pass
        # DM
        try:
            embed = discord.Embed(
                title=f"Welcome to {guild.name}!",
                description="We're glad you're here. Read the rules and have fun!",
                color=0x3498DB,
            )
            embed.set_thumbnail(url=guild.icon.url if guild.icon else None)
            await member.send(embed=embed)
        except Exception:
            pass

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        guild = member.guild
        goodbye_channel = discord.utils.get(guild.text_channels, name="goodbye")
        if not goodbye_channel and guild.system_channel:
            goodbye_channel = guild.system_channel
        if goodbye_channel:
            msg = random.choice(DEFAULT_GOODBYE_MESSAGES).format(user=member.display_name, server=guild.name)
            embed = discord.Embed(description=msg, color=0xE74C3C)
            embed.set_thumbnail(url=member.display_avatar.url)
            await goodbye_channel.send(embed=embed)

    @commands.command(name="setwelcome")
    @commands.has_permissions(administrator=True)
    async def set_welcome_msg(self, ctx: commands.Context, *, message: str):
        """Set a custom welcome message. Use {user} and {server} as placeholders."""
        embed = discord.Embed(title="Welcome Message Updated", description=message, color=0x2ECC71)
        embed.set_footer(text="This would persist to DB in a full implementation.")
        await ctx.send(embed=embed)

    @commands.command(name="setgoodbye")
    @commands.has_permissions(administrator=True)
    async def set_goodbye_msg(self, ctx: commands.Context, *, message: str):
        """Set a custom goodbye message."""
        embed = discord.Embed(title="Goodbye Message Updated", description=message, color=0xE74C3C)
        embed.set_footer(text="This would persist to DB in a full implementation.")
        await ctx.send(embed=embed)

    async def cog_load(self):
        print("Welcome cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Welcome(bot))

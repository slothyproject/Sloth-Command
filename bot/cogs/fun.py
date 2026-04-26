"""Fun cog — lighthearted commands for the community."""
from __future__ import annotations

import random

import discord
from discord.ext import commands


ROASTS = [
    "{user}, your command usage is the only thing growing slower than this bot's startup time.",
    "{user}, you're the reason the mute command was invented.",
    "{user}, if personality were a stat, you'd be a flat zero.",
    "{user}, even Discord's ping is faster than your comebacks.",
    "{user}, you bring everyone so much joy... when you leave the channel.",
]

EIGHTBALL = [
    "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes – definitely.",
    "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
    "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
    "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful.",
]


class Fun(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="roast")
    async def roast_cmd(self, ctx: commands.Context, member: discord.Member = None):
        """Roast someone (or yourself)."""
        target = member or ctx.author
        msg = random.choice(ROASTS).format(user=target.mention)
        embed = discord.Embed(description=msg, color=0xE74C3C)
        await ctx.send(embed=embed)

    @commands.command(name="8ball")
    async def eightball_cmd(self, ctx: commands.Context, *, question: str):
        """Ask the magic 8-ball a question."""
        embed = discord.Embed(title="🎱 Magic 8-Ball", color=0x9B59B6)
        embed.add_field(name="Question", value=question[:1024], inline=False)
        embed.add_field(name="Answer", value=random.choice(EIGHTBALL), inline=False)
        await ctx.send(embed=embed)

    @commands.command(name="roll")
    async def roll_cmd(self, ctx: commands.Context, sides: int = 6):
        """Roll a dice with N sides (default 6)."""
        result = random.randint(1, max(1, sides))
        embed = discord.Embed(title="🎲 Roll", description=f"You rolled **{result}** on a **d{sides}**.", color=0x3498DB)
        await ctx.send(embed=embed)

    @commands.command(name="coinflip")
    async def coinflip_cmd(self, ctx: commands.Context):
        """Flip a coin."""
        result = random.choice(["Heads", "Tails"])
        embed = discord.Embed(title="🪙 Coin Flip", description=f"**{result}**!", color=0xF1C40F)
        await ctx.send(embed=embed)

    @commands.command(name="meme")
    async def meme_cmd(self, ctx: commands.Context):
        """Fetch a random meme (placeholder)."""
        memes = [
            "When you finally get the bot to work: 🎉",
            "Discord.py users waiting for nextcord updates: ⏳",
            "Me debugging at 3AM: 🧟",
        ]
        embed = discord.Embed(title="😂 Meme", description=random.choice(memes), color=0x1ABC9C)
        await ctx.send(embed=embed)

    @commands.command(name="poll")
    async def poll_cmd(self, ctx: commands.Context, question: str, *options):
        """Create a quick poll. Usage: !poll \"Question\" Option1 Option2 [Option3]"""
        if len(options) < 2:
            options = ("Yes", "No")
        emojis = ("1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟")
        embed = discord.Embed(title="📊 Poll", description=question, color=0x3498DB)
        for i, opt in enumerate(options[:10]):
            embed.add_field(name=f"{emojis[i]} {opt}", value="\u200b", inline=False)
        poll_msg = await ctx.send(embed=embed)
        for i in range(min(len(options), 10)):
            await poll_msg.add_reaction(emojis[i])

    async def cog_load(self):
        print("Fun cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Fun(bot))

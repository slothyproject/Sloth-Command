"""Music cog — basic voice channel controls (no YouTube streaming, just queue/channel mgmt)."""
from __future__ import annotations

import discord
from discord.ext import commands


class Music(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.queues: dict[int, list[str]] = {}  # guild_id -> [titles]

    def _get_voice_state(self, guild_id: int) -> discord.VoiceClient | None:
        return self.bot.get_guild(guild_id).voice_client if self.bot.get_guild(guild_id) else None

    @commands.command(name="join")
    async def join_cmd(self, ctx: commands.Context):
        """Join the user's voice channel."""
        if not ctx.author.voice:
            await ctx.send("You are not in a voice channel.", delete_after=5)
            return
        channel = ctx.author.voice.channel
        if ctx.voice_client:
            await ctx.voice_client.move_to(channel)
        else:
            await channel.connect()
        await ctx.send(f"🔊 Joined **{channel.name}**.")

    @commands.command(name="leave")
    async def leave_cmd(self, ctx: commands.Context):
        """Leave the voice channel."""
        if ctx.voice_client:
            await ctx.voice_client.disconnect()
            await ctx.send("👋 Left the voice channel.")
        else:
            await ctx.send("I'm not in a voice channel.", delete_after=5)

    @commands.command(name="stop")
    async def stop_cmd(self, ctx: commands.Context):
        """Stop any playing audio."""
        if ctx.voice_client and ctx.voice_client.is_playing():
            ctx.voice_client.stop()
            await ctx.send("⏹️ Stopped.")
        else:
            await ctx.send("Nothing is playing.", delete_after=5)

    @commands.command(name="pause")
    async def pause_cmd(self, ctx: commands.Context):
        """Pause audio playback."""
        if ctx.voice_client and ctx.voice_client.is_playing():
            ctx.voice_client.pause()
            await ctx.send("⏸️ Paused.")
        else:
            await ctx.send("Nothing is playing.", delete_after=5)

    @commands.command(name="resume")
    async def resume_cmd(self, ctx: commands.Context):
        """Resume audio playback."""
        if ctx.voice_client and ctx.voice_client.is_paused():
            ctx.voice_client.resume()
            await ctx.send("▶️ Resumed.")
        else:
            await ctx.send("Nothing is paused.", delete_after=5)

    @commands.command(name="volume")
    async def volume_cmd(self, ctx: commands.Context, level: int):
        """Set volume (0-100)."""
        if ctx.voice_client and ctx.voice_client.source:
            level = max(0, min(100, level))
            ctx.voice_client.source.volume = level / 100
            await ctx.send(f"🔊 Volume set to **{level}%**.")
        else:
            await ctx.send("Nothing is playing.", delete_after=5)

    @commands.command(name="queue")
    async def queue_cmd(self, ctx: commands.Context):
        """Show the music queue."""
        q = self.queues.get(ctx.guild.id, [])
        if not q:
            await ctx.send("Queue is empty.")
            return
        embed = discord.Embed(title="🎵 Music Queue", color=0x9B59B6)
        for i, track in enumerate(q[:20], 1):
            embed.add_field(name=f"{i}.", value=track, inline=False)
        await ctx.send(embed=embed)

    @commands.command(name="clearqueue")
    async def clearqueue_cmd(self, ctx: commands.Context):
        """Clear the music queue."""
        self.queues[ctx.guild.id] = []
        await ctx.send("🗑️ Queue cleared.")

    async def cog_load(self):
        print("Music cog loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(Music(bot))

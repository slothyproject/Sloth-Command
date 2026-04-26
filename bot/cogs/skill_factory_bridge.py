# skill_factory_bridge.py
"""Discord cog that scaffolds both a bot command module
and a matching Factory skill file."""

from __future__ import annotations

import os
import re
from pathlib import Path

import discord
from discord.ext import commands
from jinja2 import Template


COG_TEMPLATE = '''
import discord
from discord.ext import commands

class {{ class_name }}(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="{{ command_name }}")
    async def {{ command_name }}_cmd(self, ctx: commands.Context):
        """TODO: add description."""
        await ctx.send("✅ {{ class_name }} executed!")

    async def cog_load(self):
        print("{{ class_name }} loaded.")

async def setup(bot: commands.Bot):
    await bot.add_cog({{ class_name }}(bot))
'''

SKILL_MD_TEMPLATE = Path(__file__).with_name("factory_skill.md.j2").read_text()


class SkillFactoryBridge(commands.Cog):
    """Scaffold new skills from Discord."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.repo_root = Path(__file__).resolve().parents[3]

    @commands.command(name="skill")
    @commands.is_owner()
    async def skill_cmd(self, ctx: commands.Context, action: str, name: str):
        """Create a bot cog + Factory skill. Usage: !skill create <name>"""
        if action.lower() != "create":
            await ctx.send("Usage: `!skill create <name>`")
            return

        safe_name = re.sub(r"[^a-z0-9_]", "", name.lower().replace("-", "_"))
        if not safe_name:
            await ctx.send("Invalid name.")
            return

        # Cog file
        cog_dir = self.repo_root / "bot" / "cogs"
        cog_dir.mkdir(parents=True, exist_ok=True)
        cog_path = cog_dir / f"{safe_name}.py"
        class_name = "".join(x.capitalize() for x in safe_name.split("_")) + "Skill"
        cog_content = Template(COG_TEMPLATE).render(
            class_name=class_name,
            command_name=safe_name,
        )
        cog_path.write_text(cog_content.strip() + "\n")

        # Factory skill
        skills_dir = self.repo_root / ".factory" / "skills" / safe_name
        skills_dir.mkdir(parents=True, exist_ok=True)
        skill_md_path = skills_dir / "SKILL.md"
        skill_md_content = Template(SKILL_MD_TEMPLATE).render(
            skill_name=safe_name,
            class_name=class_name,
            cog_path=str(cog_path.relative_to(self.repo_root)).replace("\\", "/"),
        )
        skill_md_path.write_text(skill_md_content.strip() + "\n")

        await ctx.send(
            f"✅ Created **{class_name}**\n"
            f"• Cog: `{cog_path.relative_to(self.repo_root)}`\n"
            f"• Skill: `{skill_md_path.relative_to(self.repo_root)}`"
        )

    async def cog_load(self):
        print("SkillFactoryBridge loaded.")


async def setup(bot: commands.Bot):
    await bot.add_cog(SkillFactoryBridge(bot))

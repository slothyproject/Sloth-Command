---
title: Contributing to Dissident
description: How to add cogs, features, and contribute code.
order: 1
tags: [contributing, development, cogs]
---

# Contributing to Dissident

## Development Setup

```bash
git clone https://github.com/slothyproject/sloth-command-platform.git
cd sloth-command-platform
python -m venv venv
source venv/bin/activate  # or .\\venv\\Scripts\\activate on Windows
pip install -r requirements.txt
```

## Adding a New Cog

The easiest way is via the existing `!skill create` command or the factory bridge.

### Manual Method

1. Create `bot/cogs/my_feature.py`:

```python
import discord
from discord.ext import commands

class MyFeature(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.command(name="hello")
    async def hello_cmd(self, ctx: commands.Context):
        await ctx.send(f"Hello {ctx.author.mention}!")

    async def cog_load(self):
        print("MyFeature cog loaded.")

async def setup(bot: commands.Bot):
    await bot.add_cog(MyFeature(bot))
```

2. Register in `modules.yaml`:

```yaml
cogs:
  - name: my_feature
    description: My new feature
    enabled: true
    path: bot/cogs/my_feature.py
```

3. Restart the bot. The cog auto-loads.

## Adding Dashboard Pages

1. Create `frontend/src/pages/MyPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Build: `cd frontend && npm run build`

## Running Tests

```bash
# Python tests
pytest tests/ -v

# Frontend lint + typecheck
cd frontend && npm run build
```

## Code Style

- Python: `ruff check .`
- TypeScript: `tsc --noEmit`
- Always run both before committing

## Pull Request Guidelines

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` code restructuring
   - `security:` security-related
4. Push and open a PR against `main`
5. CI must pass (lint, frontend build)

## GitHub Wiki

The project auto-generates documentation on every push via `.github/workflows/wiki-refresh.yml`. To manually refresh:

```bash
droid exec --auto high "/wiki"
```

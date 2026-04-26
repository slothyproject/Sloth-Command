---
title: Troubleshooting Common Issues
description: Fixes for the most common Dissident errors and problems.
order: 1
tags: [troubleshooting, errors, faq]
---

# Troubleshooting Common Issues

## Bot Shows as Offline

### Check 1: Is Redis Connected?

The dashboard reads bot state from Redis key `dissident:bot_state`:

```bash
redis-cli GET dissident:bot_state
```

If it returns `(nil)`, the bot has not written its state. Check the bot logs for Redis connection errors.

### Check 2: Is the Bot Actually Online?

In a Discord server where the bot is a member, run `!ping`. If no response:

- Check Railway logs for `DISSIDENT_TOKEN` or `DISCORD_BOT_TOKEN`
- Verify the token is valid (not expired/regenerated)
- Ensure the bot has the `message_content` privileged intent enabled in Discord Developer Portal

### Check 3: Stale Threshold

The dashboard considers the bot offline if the state hasn't been updated in **120 seconds**. Slow Redis or bot crashes can trigger this.

## "Failed to Load Analytics Data"

### Causes

1. **SQLAlchemy 2.0 regression** — Fixed in commit `93deffa`
2. **Database connection limit reached** — Check Railway Postgres metrics
3. **Missing tables** — Ensure `_run_migrations()` ran in `dashboard/app.py`

### Fix

```bash
# Check if tables exist
railway run python -c "from dashboard.app import create_app; app=create_app()"
```

## Discord OAuth Fails

### Redirect URI Mismatch

1. Discord Developer Portal → OAuth2 → General → Redirects
2. Must exactly match your `DISCORD_REDIRECT_URI` env var
3. Common mistake: trailing slash mismatch (`/callback` vs `/callback/`)

### Invalid Client Secret

Regenerate the secret in Discord Developer Portal and update Railway env vars.

## AI Operator Returns "Unsupported operation"

The AI Operator's system prompt might generate operations we haven't implemented yet. Check the plan preview before confirming. If you see an unsupported op, report it as a feature request.

## Redis Connection Errors

```
Redis unavailable: Error 111 connecting to localhost:6379. Connection refused.
```

### Fix

Set `REDIS_URL` environment variable correctly:
- Local: `redis://localhost:6379/0`
- Railway: `redis://default:PASSWORD@.../0`

## Database Migration Errors

If you see errors about missing columns on startup, the auto-migration failed:

```bash
# Manual fix via Railway console
railway run python -c "
from dashboard.app import create_app
app = create_app()
with app.app_context():
    from dashboard.extensions import db
    db.create_all()
"
```

## Webhook Signature Mismatch

The bot must send events with HMAC-SHA256:

```python
import hmac, hashlib
secret = os.environ["WEBHOOK_SECRET"]
mac = hmac.new(secret.encode(), request.data, hashlib.sha256)
expected = "sha256=" + mac.hexdigest()
```

Verify `WEBHOOK_SECRET` is identical on both bot and hub services.

## Still Stuck?

- Check the [GitHub Discussions](https://github.com/slothyproject/sloth-command-platform/discussions)
- Open an issue with `"[BUG]"` prefix
- Contact: support@mastertibbles.co.uk

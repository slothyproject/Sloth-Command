# Architecture — Dissident Central Hub

## Overview

The Dissident ecosystem consists of several independent services. This repo,
**Dissident Central Hub**, is the management layer — it provides the web
dashboard, REST API, Discord OAuth, and background workers. It does **not**
contain the bot itself.

## Service map

| Service | Repo | Railway service | URL |
|---------|------|-----------------|-----|
| Central Hub (this repo) | `dissident-central-hub` | `dissident-central-hub` | `hub.mastertibbles.co.uk` |
| Dissident Bot | `dissident` | `Dissident Bot 2.0` | `dissidentbot.mastertibbles.co.uk` |
| Public website | `Dissident-Website` | `Dissident-Website` | `dissident.mastertibbles.co.uk` |
| Token Vault | `Tokens-Vault` | `dissident-tokens-vault` | `dissidenttokens.mastertibbles.co.uk` |
| PostgreSQL (Hub) | — | `central-hub-postgres` | internal |
| PostgreSQL (Bot) | — | `Postgres` | internal |
| Redis | — | `Redis` | internal |

## This repo's structure

```
dissident-central-hub/
├── Dockerfile               # Single production Dockerfile
├── railway.toml             # Railway deployment config
├── docker-compose.yml       # Local development stack
├── requirements.txt         # All Python dependencies
│
├── dashboard/               # Flask web application
│   ├── app.py               # Application factory
│   ├── extensions.py        # Shared db/redis instances
│   ├── models.py            # Hub-only DB models
│   ├── routes/
│   │   ├── auth.py          # Discord OAuth + local login
│   │   ├── core.py          # Page routes (HTML)
│   │   └── api.py           # REST API (/api/*)
│   ├── services/
│   │   └── bot_state.py     # Reads bot state from Redis
│   ├── templates/           # Jinja2 templates
│   └── static/              # CSS + JS
│
├── worker/
│   └── scheduler.py         # Background task worker
│
├── docs/                    # Documentation (here)
│   ├── architecture.md
│   └── deployment.md
│
└── .github/
    └── workflows/
        └── ci.yml           # Single CI/CD pipeline
```

## How the bot and Hub communicate

The bot writes its state to Redis key `bot:state` every 2 seconds:

```json
{
  "online": true,
  "guild_count": 42,
  "member_count": 12500,
  "latency_ms": 48,
  "commands_today": 1203,
  "uptime": "3d 4h 12m",
  "cog_count": 71,
  "version": "2.11.0"
}
```

The Hub reads this key in `dashboard/services/bot_state.py` and falls back
to a safe offline payload if Redis is unavailable.

Admin actions (sync guilds, reload config) are published to Redis channel
`hub:commands` and consumed by the bot's subscriber.

## Auth flow

1. User clicks "Continue with Discord"
2. Hub redirects to Discord OAuth with `identify guilds email` scope
3. Discord redirects back to `/auth/callback`
4. Hub exchanges the code for a token, fetches the user profile, upserts the
   `hub_users` record, and logs in via Flask-Login
5. Local admin login is also available for the initial `ADMIN_USER` account

## Database

The Hub uses its own Postgres (`central-hub-postgres`) with a small schema:

- `hub_users` — web panel users (Discord OAuth + local)
- `hub_guilds` — mirror of Discord guilds, synced from bot
- `hub_audit_log` — all auth and admin actions

The bot's 64+ tables live in a separate Postgres instance and are never
directly accessed by the Hub.

## Railway service layout

```
Railway project: resplendent-fulfillment
├── dissident-central-hub   → this repo, web service, PORT 8080
├── Dissident Bot 2.0       → dissident repo, worker (no HTTP)
├── Dissident-Website       → static site
├── dissident-tokens-vault  → static site
├── central-hub-postgres    → Postgres for Hub
├── Postgres                → Postgres for Bot
└── Redis                   → shared Redis (Hub + Bot)
```

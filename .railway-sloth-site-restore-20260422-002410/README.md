# Dissident Central Hub

Management dashboard and API for the Dissident Discord bot ecosystem.

**Live:** `hub.mastertibbles.co.uk`  
**Railway project:** `resplendent-fulfillment`

---

## What this is

Dissident Central Hub is the control layer for the Dissident platform. It provides:

- **Web dashboard** — real-time bot stats, server management, moderation tools, ticket viewer, audit log
- **REST API** — consumed by the dashboard and optionally external tooling
- **Discord OAuth** — sign in with Discord; no separate auth service needed
- **Background worker** — guild sync, session cleanup, scheduled tasks

The bot itself (`dissident` repo) is separate. This repo talks to the bot exclusively via Redis pub/sub.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Web framework | Flask 3 + Gunicorn + gevent |
| Real-time | Flask-SocketIO + Redis |
| Database | PostgreSQL (via SQLAlchemy) |
| Auth | Discord OAuth + Flask-Login |
| Deployment | Docker → Railway |
| CI/CD | GitHub Actions (single workflow) |

---

## Quick start (local)

```bash
git clone https://github.com/slothyproject/dissident-central-hub.git
cd dissident-central-hub

cp .env.example .env
# Edit .env with your values

docker compose up
```

Hub runs at `http://localhost:8080`.

---

## Project structure

```
dissident-central-hub/
├── dashboard/          Flask app (routes, models, templates, static)
│   ├── routes/         auth.py · core.py · api.py
│   ├── services/       bot_state.py (reads Redis)
│   ├── templates/      Jinja2 HTML
│   └── static/         CSS + JS
├── worker/             Background scheduler
├── docs/               Architecture + deployment guides
├── Dockerfile          Single production image
├── railway.toml        Railway config
└── docker-compose.yml  Local dev stack
```

---

## Documentation

- [Architecture](docs/architecture.md) — service map, data flows, DB schema
- [Deployment](docs/deployment.md) — Railway setup, env vars, migrations

---

## Environment variables

See `.env.example` for the full list. Required in production:

```
SECRET_KEY          Flask session secret (32 random bytes)
DATABASE_URL        PostgreSQL connection string
REDIS_URL           Redis connection string
DISCORD_CLIENT_ID   Discord OAuth app ID
DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI
ADMIN_USER          Initial admin account username
ADMIN_PASS          Initial admin account password
```

---

## Related repos

| Repo | Purpose |
|------|---------|
| [`dissident`](https://github.com/slothyproject/dissident) | The Discord bot (Python, 71 cogs) |
| [`Dissident-Website`](https://github.com/slothyproject/Dissident-Website) | Public landing page (Astro.js) |
| [`Tokens-Vault`](https://github.com/slothyproject/Tokens-Vault) | Secure credential store |

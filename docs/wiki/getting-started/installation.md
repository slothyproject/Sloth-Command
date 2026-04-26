---
title: Installation & Self-Hosting
description: How to run Dissident on your own infrastructure.
order: 2
tags: [self-hosting, installation, docker]
---

# Installation & Self-Hosting

## Requirements

- Python 3.12+
- PostgreSQL 14+
- Redis 7+
- Node.js 20+ (for frontend builds)
- Discord Bot Token

## Local Development

```bash
# 1. Clone the repository
git clone https://github.com/slothyproject/sloth-command-platform.git
cd sloth-command-platform

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install frontend dependencies
cd frontend
npm install
npm run build
cd ..

# 4. Set environment variables
cp .env.example .env
# Edit .env with your Discord credentials, database URL, etc.

# 5. Run database migrations
python -c "from dashboard.app import create_app; app = create_app(); app.run(debug=True, port=8080)"
```

## Docker Compose

```bash
# Full stack with Postgres and Redis
docker-compose up --build
```

## Railway (Production)

1. Fork/clone the repo to your GitHub account
2. Create a Railway project
3. Link the GitHub repo — Railway auto-detects the Dockerfile
4. Set required environment variables in Railway dashboard
5. Push to `main` — CI/CD auto-deploys

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | 64-character hex secret |
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `DISCORD_CLIENT_ID` | From Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | From Discord Developer Portal |
| `DISCORD_REDIRECT_URI` | `https://slothlee.xyz/auth/callback` |
| `DISCORD_BOT_TOKEN` | Bot token for the Discord API |
| `ADMIN_USER` | Dashboard admin username |
| `ADMIN_PASS` | Dashboard admin password |
| `BOT_INTERNAL_API_KEY` | Shared secret between hub and bot |

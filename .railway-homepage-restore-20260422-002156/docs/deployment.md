# Deployment guide

## Prerequisites

- Railway project: `resplendent-fulfillment`
- Railway CLI installed: `npm install -g @railway/cli`
- `RAILWAY_TOKEN` set in GitHub Actions secrets

## First-time setup

### 1. Create the Railway service

In the Railway dashboard, create a new service linked to this repo.
Set the build source to `Dockerfile` (Railway will detect it automatically).

### 2. Set environment variables

In the Railway service settings, add:

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Link to `central-hub-postgres`: `${{central-hub-postgres.DATABASE_URL}}` |
| `REDIS_URL` | Link to `Redis`: `${{Redis.REDIS_URL}}` |
| `DISCORD_CLIENT_ID` | From Discord developer portal |
| `DISCORD_CLIENT_SECRET` | From Discord developer portal |
| `DISCORD_REDIRECT_URI` | `https://hub.mastertibbles.co.uk/auth/callback` |
| `ADMIN_USER` | Your admin username |
| `ADMIN_PASS` | A strong password |

### 3. Set the custom domain

In Railway, point `hub.mastertibbles.co.uk` to this service.

### 4. Run database migrations

```bash
railway run alembic upgrade head
```

Or via the Railway console in the dashboard.

## Deploying

CI/CD runs automatically on push to `main` via `.github/workflows/ci.yml`.

To deploy manually:
```bash
railway up --service dissident-central-hub
```

## Local development

```bash
cp .env.example .env
# Fill in your values

docker compose up
```

The Hub is then available at `http://localhost:8080`.

## Logs

```bash
railway logs --service dissident-central-hub
```

## Rolling back

In the Railway dashboard, go to the service → Deployments → pick a previous
deployment → Redeploy.

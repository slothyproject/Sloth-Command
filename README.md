# 🦥 Sloth Command Platform

> Management dashboard for the Dissident Discord bot ecosystem.

| Service | URL |
|---------|-----|
| **Dashboard** | [dissidenthub.mastertibbles.co.uk](https://dissidenthub.mastertibbles.co.uk) |
| **Node.js API** | [central-hub-api-production.up.railway.app/api/health](https://central-hub-api-production.up.railway.app/api/health) |

## Stack
- **Flask** dashboard (blueprints: core, api, auth)
- **PostgreSQL** + **Redis** on Railway
- **TypeScript API** service (`central-hub-v3/apps/api/`)
- **Dissident bot panel** mounted at `/bot`

## Local dev
```bash
pip install -r requirements.txt
gunicorn wsgi:application
```

CI/CD auto-deploys on push to `main`.

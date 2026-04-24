# Sloth Command Platform

> Unified dashboard, bot panel & API gateway for the Dissident Discord bot ecosystem.

[![CI / Deploy](https://github.com/slothyproject/sloth-command-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/slothyproject/sloth-command-platform/actions/workflows/ci.yml)

## Services

| Service | URL | Description |
|---|---|---|
| **Dissident Hub** | [dissidenthub.mastertibbles.co.uk](https://dissidenthub.mastertibbles.co.uk) | Bot management dashboard |
| **Sloth Command API** | [central-hub-api-production.up.railway.app](https://central-hub-api-production.up.railway.app/api/health) | Node.js TypeScript API gateway |
| **Dissident Website** | [dissident.mastertibbles.co.uk](https://dissident.mastertibbles.co.uk) | Public marketing site |

## Architecture

```
sloth-command-platform/
├── dashboard/          Flask app — Dissident Hub (bot management)
│   ├── routes/         core, auth, api blueprints
│   ├── templates/      Jinja2 templates
│   └── static/         CSS, JS, assets
├── dissident_panel/    Bot web panel (merged from separate service)
├── central-hub-v3/     
│   └── apps/api/       Node.js TypeScript API gateway (deployed via GHCR)
├── worker/             Background scheduler
└── wsgi.py             WSGI entry point (composes both apps)
```

## Stack

- **Dashboard**: Python 3.12 · Flask · SQLAlchemy · Redis · Gevent
- **API**: Node.js 20 · TypeScript · Prisma · Bull · Redis
- **Deploy**: Railway · Docker · GitHub Actions → GHCR

## Quick links

- [Railway Project](https://railway.com/project/4e4e0f03-0c70-443a-ab59-757c492a8142)
- [Dissident Bot Repo](https://github.com/slothyproject/dissident)
- [Deploy Guide](DEPLOYMENT-GUIDE.md)

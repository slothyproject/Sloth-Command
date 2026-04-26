---
title: API Reference
description: REST API endpoints for the Dissident dashboard and bot.
order: 1
tags: [api, rest, endpoints]
---

# API Reference

## Authentication

All API endpoints (except `/health` and public stats) require one of:

1. **Session cookie** — Set by Discord OAuth or local login
2. **Bearer token** — Not yet implemented (future)

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "sloth-lee-command-hub",
  "version": "1.0.0"
}
```

## Auth

### Get Current User

```
GET /auth/me
```

Response:
```json
{
  "id": 1,
  "username": "sirtibbles69",
  "is_owner": true,
  "is_admin": true,
  "guilds": [...]
}
```

### Discord Login

```
GET /auth/login/discord
```

Redirects to Discord OAuth. Callback at `/auth/callback`.

### Local Login

```
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=sirtibbles69&password=******
```

Rate limited to 10/minute. Brute-force protection: 5 failed attempts in 15min = 429.

## Guilds

### List Guilds

```
GET /api/guilds
```

Returns guilds the current user can access. Admins see all.

### Guild Details

```
GET /api/guilds/:id
```

## Bot State

### Get Bot State

```
GET /api/bot
```

Response:
```json
{
  "online": true,
  "status": "online",
  "guild_count": 42,
  "member_count": 12500,
  "latency_ms": 48,
  "commands_today": 1203,
  "cog_count": 11
}
```

### Health Detail

```
GET /api/bot/health-detail
```

24-hour event sparkline + command counts.

## Moderation

### List Cases

```
GET /api/guilds/:id/moderation
```

### Create Case

```
POST /api/moderation
Content-Type: application/json

{
  "guildId": "...",
  "userId": "...",
  "action": "warn",
  "reason": "Spam"
}
```

## Tickets

### List Tickets

```
GET /api/guilds/:id/tickets
```

### Open Ticket

```
POST /api/tickets
Content-Type: application/json

{
  "guildId": "...",
  "userId": "...",
  "subject": "Help!",
  "priority": "normal"
}
```

## AI Operator

### Parse Command

```
POST /api/ai/operator
Content-Type: application/json

{
  "message": "Mute @User for 1 hour",
  "guild_id": 123,
  "dry_run": true,
  "research": false
}
```

### Execute Plan

```
POST /api/ai/operator/confirm
Content-Type: application/json

{
  "steps": [...]
}
```

## AI Advisor

### Generate Blueprint

```
POST /api/ai/advisor
Content-Type: application/json

{
  "prompt": "Create a cog for VRChat events",
  "blueprint_type": "cog"
}
```

## Webhooks

### Bot Events

```
POST /api/webhook/bot
Content-Type: application/json
X-Hub-Signature: sha256=...
```

Events: `guild_join`, `guild_leave`, `mod_action`, `ticket_open`, `ticket_close`

## Rate Limits

| Route | Limit |
|-------|-------|
| `/api/*` | 10000/day, 2000/hour (default) |
| `/auth/login` | 10/minute |
| `/auth/login/discord` | 20/minute |
| `/api/ai/*` | Per-user hourly limit (default 100) |

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (permission denied) |
| 404 | Not found |
| 429 | Rate limited |
| 502 | AI provider error |
| 503 | Key decryption failed |

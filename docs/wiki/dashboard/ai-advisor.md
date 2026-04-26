---
title: AI Advisor (BYOK Blueprints)
description: Use your own AI provider key to generate Discord bot blueprints.
order: 3
tags: [ai-advisor, byok, blueprints]
---

# AI Advisor (BYOK Blueprints)

## What is BYOK?

**Bring Your Own Key.** The AI Advisor lets you plug in your own OpenAI, Anthropic, Gemini, or Ollama credentials instead of using a shared account.

## Supported Providers

| Provider | Free Tier? | Notes |
|----------|-----------|-------|
| OpenAI | Trial credits | GPT-4o-mini recommended for cost |
| Anthropic | Limited | Claude 3.5 Haiku for speed |
| Google Gemini | Generous | 2.0 Flash is fast and cheap |
| Ollama (Self-hosted) | Fully free | Llama 3.1 8B works great locally |
| Ollama Cloud | Pay per request | Kimi K2.6 via ollama.com |
| Custom OpenAI | Varies | Any OpenAI-compatible API |

## Setup

1. Go to **Settings → AI Provider**
2. Select provider and enter your API key
3. Choose a model (pre-filled defaults)
4. Set hourly rate limit (default: 100)
5. Click **Validate** — we ping the API to confirm it works
6. Save

## Encryption

Your API key is:
- **Encrypted at rest** using AES-256-GCM
- **Never logged**
- **Only decrypted at runtime** when making API calls

## Blueprints

The AI Advisor generates bot blueprints for:

| Blueprint Type | Description |
|-------------|-------------|
| `cog` | Complete Discord cog with commands and listeners |
| `command` | Single command with full error handling |
| `event` | Discord.py event handler |
| `config` | Guild settings schema |
| `database` | SQLAlchemy model templates |

## Rate Limits

Per-user rate limits prevent abuse:
- Default: 100 requests/hour
- Owner override: unlimited
- Hard cap: 10,000/hour per user

## Troubleshooting

| Error | Fix |
|-------|-----|
| "Invalid API key" | Re-enter key; check for trailing spaces |
| "Could not reach provider" | Check internet; verify base URL for self-hosted |
| "Rate limit hit" | Wait 1 hour or reduce prompt complexity |
| "Decryption failed" | Re-save the key; old DB corruption |

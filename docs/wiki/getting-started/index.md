---
title: Getting Started with Dissident
description: First-time setup guide for the Dissident Discord bot and dashboard.
order: 1
tags: [getting-started, setup, invite]
---

# Getting Started with Dissident

Welcome to Dissident! This guide walks you through the first steps to get your Discord bot and dashboard running.

## What is Dissident?

Dissident is an all-in-one Discord bot management platform. It includes:

- A powerful **Discord bot** with 10+ cogs (moderation, tickets, economy, music, and more)
- A **web dashboard** at [slothlee.xyz](/) for managing your server
- An **AI Operator** that lets you control the bot with natural language

## Step 1: Invite the Bot

1. Go to your server's settings and generate an invite link with the required permissions
2. Use the OAuth2 URL generator in the Discord Developer Portal:
   - Scope: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (recommended for full functionality)
   - Or minimum: `Send Messages`, `Manage Messages`, `Kick Members`, `Ban Members`, `Manage Roles`, `Manage Channels`, `View Audit Log`, `Moderate Members`, `Read Message History`
3. Authorize the bot to join your server

## Step 2: Open the Dashboard

1. Visit [slothlee.xyz](https://slothlee.xyz)
2. Log in with Discord OAuth — we only request `identify`, `guilds`, and `email`
3. Select your server from the server picker

## Step 3: Configure Basic Settings

Navigate to **Settings** in the dashboard sidebar:

| Setting | Recommended Value |
|---------|------------------|
| Prefix | `!` |
| Language | `en` |
| Mod Log Channel | Create `#mod-logs` |
| Ticket Category | Create `Tickets` category |

## Step 4: Test a Command

In your Discord server, try:

```
!ping
!help
!serverinfo
```

If the bot responds, you're all set!

## Next Steps

- [Dashboard User Guide](/docs/dashboard/user-guide) — Learn the dashboard layout
- [Bot Commands](/docs/commands/moderation) — Full command reference
- [AI Operator](/docs/dashboard/ai-operator) — Control your bot with natural language

---
title: Dashboard User Guide
description: Complete guide to navigating and using the Dissident web dashboard.
order: 1
tags: [dashboard, guide, ui]
---

# Dashboard User Guide

## Overview

The Dissident dashboard at [slothlee.xyz](https://slothlee.xyz) is your command center for managing Discord servers, monitoring bot health, and running the AI Operator.

## Navigation

| Page | Icon | Description |
|------|------|-------------|
| Dashboard | Home | Overview cards, bot status, quick stats |
| Servers | Globe | List of guilds the bot is in |
| Server Detail | Settings | Per-guild configuration |
| Tickets | Ticket | Open, assign, and close tickets |
| Moderation | Shield | Recent mod actions |
| Analytics | BarChart | Usage charts and trends |
| Logs | Scroll | System audit log |
| Users | Users | User management |
| Settings | Cog | Global and guild settings |
| AI Advisor | Brain | AI-powered blueprint generator |
| AI Operator | Wand | Natural language bot operator |

## Server Selection

When you select a server from the sidebar, the dashboard switches to **server-scoped** mode. Only settings, commands, and data for that guild are shown.

## Bot Status Card

The top-right card shows live bot status:
- **Online/Offline** — based on Redis heartbeat
- **Latency** — last known API latency
- **Guilds** — total number of servers
- **Uptime** — days since last restart

## AI Operator Quick Start

1. Click **AI Operator** in the sidebar
2. Type a natural language command:
   ```
   Mute @user#1234 for 1 hour because spam
   ```
3. Review the preview plan
4. Click **Execute** (or turn on auto-execute in Settings)

The AI Operator supports 20+ operation types. See [AI Operator Guide](/docs/dashboard/ai-operator) for details.

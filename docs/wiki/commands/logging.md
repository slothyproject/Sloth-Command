---
title: Logging Cog Manual
description: Setup, configuration, and event monitoring with the Dissident logging system.
order: 1
---

# Logging Cog

The logging cog records server events across message edits, deletions, joins, leaves, bans, unbans, voice channel updates, role changes, and moderation actions.

---

## Setup

```
!log_channel #logs
```

This designates `#logs` (or any channel) to receive embeds.

## Events Logged

| Event | Notes |
|-------|-------|
| Message edits | Before + after content |
| Message deletions | Author + content snippet |
| Member joins | Account age, invite used |
| Member leaves | Role list preserved |
| Bans / unbans | Executor + reason |
| Voice state changes | Join, move, disconnect |
| Role changes | Added / removed roles |
| Nickname change | Before + after |

## Webhook Mode

For zero-latency delivery, configure a webhook URL in the dashboard:

1. Go to **Dashboard → Server → Logging**
2. Toggle **Webhook Mode**
3. Paste your Discord webhook URL
4. Choose event types

## Ignored Channels

Add channels to the ignore list to suppress noise:

```
!log ignore #bot-commands
```

## Dashboard

Use **Dashboard → Server → Logging** for:
- Toggle individual events
- Set custom log channel per event type
- Export logs as CSV
- Configure auto-purge retention

---

**Recommended:** Create a #mod-logs private channel for moderation actions and #server-logs for general events.

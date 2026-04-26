# Discord Permissions Reference

This page lists every Discord permission required by different Dissident features and commands.

## Moderation

| Command | Required Permission |
|---------|--------------------|
| `!kick` | `kick_members` |
| `!ban` | `ban_members` |
| `!unban` | `ban_members` |
| `!warn` | `manage_messages` |
| `!mute` | `moderate_members` |
| `!timeout` | `moderate_members` |
| `!clear` | `manage_messages` |
| `!slowmode` | `manage_channels` |

## Tickets

| Command | Required Permission |
|---------|--------------------|
| `!ticket` | None |
| `!close` | `manage_channels` or ticket creator |
| `!ticket config` | `administrator` |

## Logging

| Action | Required Permission |
|--------|--------------------|
| Configuring log settings | `administrator` |

## Automod

| Command | Required Permission |
|---------|--------------------|
| `!automod` | `manage_guild` |

## Economy

| Command | Required Permission |
|---------|--------------------|
| `!balance` | None |
| `!daily` | None |
| `!work` | None |
| `!economy reset` | `administrator` |

## Leveling

| Command | Required Permission |
|---------|--------------------|
| `!rank` | None |
| `!leaderboard` | None |
| `!level config` | `manage_guild` |

## Voice / Music

| Command | Required Permission |
|---------|--------------------|
| `!play` | None |
| `!skip` | `manage_channels` |
| `!queue` | None |
| `!stop` | `manage_channels` |

## Utilities

| Command | Required Permission |
|---------|--------------------|
| `!stats` | None |
| `!poll` | None |
| `!reminder` | None |
| `!avatar` | None |

---

**Key**
- **None** — Any member can use this command.
- **`administrator` or `manage_guild`** — Server admin required.
- **`moderate_members`** — Built-in timeout permission (no role needed).
- **`manage_messages` / `manage_channels`** — Moderator-level permissions.

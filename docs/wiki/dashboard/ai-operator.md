---
title: AI Operator Guide
description: Control your Discord bot with natural language using the AI Operator.
order: 2
tags: [ai-operator, natural-language, automation]
---

# AI Operator Guide

## What is the AI Operator?

The AI Operator lets you control your Discord bot by typing plain English (or any language) instead of memorizing command syntax.

## Supported Operations

### Moderation
| Operation | Example |
|-----------|---------|
| `moderation/ban` | "Ban @User for toxicity" |
| `moderation/kick` | "Kick @User from the server" |
| `moderation/mute` | "Mute @User for 2 hours" |
| `moderation/unmute` | "Unmute @User" |
| `moderation/warn` | "Warn @User about NSFW content" |
| `moderation/purge` | "Delete last 50 messages in #general" |
| `moderation/slowmode` | "Set slowmode to 10s in #chat" |
| `moderation/lock` | "Lock #announcements" |
| `moderation/unlock` | "Unlock #announcements" |

### Voice
| Operation | Example |
|-----------|---------|
| `voice/join` | "Join the general voice channel" |
| `voice/leave` | "Leave voice channel" |
| `voice/move` | "Move @User to Stage" |

### Role Management
| Operation | Example |
|-----------|---------|
| `role/assign` | "Give @User the Moderator role" |
| `role/remove` | "Remove Admin from @User" |
| `role/create` | "Create a VIP role" |
| `role/delete` | "Delete the Test role" |

### Channel Management
| Operation | Example |
|-----------|---------|
| `channel/create` | "Create a new #announcements channel" |
| `channel/delete` | "Delete #temp-channel" |
| `channel/rename` | "Rename #general to #chat" |

### Bulk & Message
| Operation | Example |
|-----------|---------|
| `bulk/mute` | "Mute these 5 users for spam" |
| `bulk/ban` | "Ban all 3 alt accounts" |
| `message/bulk_delete` | "Purge 100 messages in #spam" |
| `message/send` | "Send 'Event starts now!' in #events" |

## How It Works

1. **Parse** — Your message is sent to an AI provider (OpenAI, Anthropic, Gemini, Ollama)
2. **Plan** — AI returns a JSON plan of Discord API operations
3. **Preview** — The dashboard shows you what will happen before execution
4. **Execute** (or Auto-Execute) — The plan is sent to the bot via Redis pub/sub

## Settings

- **Auto-Execute** — Skip preview for trusted operations
- **Research Mode** — AI sees live guild data (ticket counts, recent mod cases)
- **Provider** — Choose your BYOK AI provider in Settings → AI Provider

## Confirmation Flow

When an operation is destructive (ban, kick, delete channel), the AI Operator always requires confirmation unless auto-execute is on.

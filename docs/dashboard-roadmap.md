# Dashboard Roadmap

The active product surface is the React dashboard served at `/app`. This document is the current source of truth for dashboard feature planning and parallel repository cleanup.

## Objectives

- Strengthen owner and admin authority without widening access beyond the right guild scope.
- Improve guild-scoped workflows for settings, moderation, tickets, and commands.
- Increase operational visibility with analytics, audit export, and live status updates.
- Reduce repo and deployment friction by cleaning stale artifacts and consolidating documentation over time.

## Phase 1: Operator Workflows

- Expand audit and activity tooling with search, filtering, and export for owner and admin investigations.
- Improve role-aware workflows for guild members, staff actions, and safer error states in the UI.
- Add clearer empty, loading, and failure states across the `/app` dashboard so operators can recover quickly.

## Phase 2: Operational Visibility

- Build analytics views for guild health, moderation volume, ticket flow, and command activity.
- Add a live event stream for moderation actions, ticket updates, and bot status changes.
- Surface owner-only cross-guild summaries alongside per-guild operational views.

## Phase 3: Owner And Admin Productivity

- Add onboarding and setup guidance for new guild managers after invite or first login.
- Add settings validation and configuration warnings before bad values are saved.
- Improve ticket assignment, SLA-style tracking, and bulk actions for high-volume moderation and support work.

## Phase 4: Technical Hardening

- Add focused tests for `/auth/me`, guild access rules, and role-gated dashboard flows.
- Improve request correlation, structured logging, and error reporting for production debugging.
- Review caching for high-traffic dashboard endpoints and consolidate deployment guidance.

## Project Cleanup

- Remove stale restore folders and extra `dist-agent` outputs that are not referenced by tracked source files.
- Consolidate overlapping deployment notes and scripts in a separate follow-up pass after the safe cleanup lands.
- Keep generated clutter out of version control with explicit ignore rules for restore, temp, and alternate build folders.

## Current Decisions

- The owner role remains a first-class dashboard role above normal admin access.
- `frontend/dist` stays in place for now because Flask serves `/app` from that runtime path.
- Restore snapshots and extra `dist-agent` folders are cleanup candidates and not part of the maintained project surface.

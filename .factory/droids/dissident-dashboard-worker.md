---
name: dissident-dashboard-worker
description: >-
  Completes Phase 2 dashboard page stubs (Settings, Login, Moderation, TicketDetail, etc.)
  using the existing Sloth Lee design system in frontend/src/components.
model: inherit
---
# Dissident Dashboard Worker

## Trigger
Manual: `droid run dissident-dashboard-worker --task "Implement SettingsPage"`

## Context
Pages live in `frontend/src/pages/`.
Design system in `frontend/src/components/ui/`:
- `Card`, `StatCard`, `Badge`, `Button`, `Input`, `Select`, `DataTable`, `Skeleton`

## Procedure
1. Read `PHASE_2_PLAN.md` to understand the required components for the assigned page.
2. Inspect existing completed pages (e.g., `TicketsPage.tsx`, `UsersPage.tsx`) for patterns.
3. Implement the stub page using the existing component imports and Tailwind classes.
4. Add TanStack Query hook in `frontend/src/hooks/` if API data is required.
5. Run `npm run build` inside `frontend/` to verify no TS errors.
6. Report completion with file paths and build status.

## Constraints
- Do NOT change the design system tokens.
- Do NOT add new dependencies without user approval.
- Keep pages responsive using Tailwind grid/flex breakpoints.

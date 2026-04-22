<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16. APIs and conventions can differ from older releases. Before major framework edits, review docs in `node_modules/next/dist/docs/` and follow deprecation warnings.
<!-- END:nextjs-agent-rules -->

# Agent Instructions: central-hub-v3/apps/web

These instructions are for AI coding agents working in this app only.

## Scope

- Primary scope: `apps/web/**`
- Adjacent dependency: `apps/api/**` (API contracts and integration)
- Shared package: `packages/shared-types/**`

## Fast Start

Run commands from repo root (`central-hub-v3/central-hub-v3`) unless noted.

```bash
# Install all workspace deps
npm install

# Start both apps
npm run dev

# Start only web
npm run dev:web

# Build web
npm run build:web

# Lint and test web (run from apps/web)
cd apps/web
npm run lint
npm test
```

## Architecture Boundaries

- Web UI and route logic live in `apps/web/app/**`.
- Reusable UI components live in `apps/web/app/components/ui/**`; prefer extending existing components over creating near-duplicates.
- API calls should go through `apps/web/app/lib/api-client.ts` and query hooks in `apps/web/app/hooks/**`.
- Avoid hardcoding endpoint URLs in page/components code. Use env vars and API client abstractions.
- Backend changes belong in `apps/api/**`; keep web-only PRs focused unless an API contract change is required.

## Coding Conventions

- Use TypeScript strict-safe patterns; avoid `any` unless unavoidable and documented.
- Keep file naming consistent:
  - Components: PascalCase
  - Hooks: `use*` camelCase
  - Utility files: kebab-case
- Use existing stack and patterns:
  - Tailwind for styling
  - TanStack Query for server state
  - Zustand for app state
- Prefer modifying existing feature modules over introducing parallel patterns.

## Validation Checklist

Before finishing changes in `apps/web`:

```bash
cd apps/web
npm run lint
npm test
npm run build
```

If your change touches API integration, also validate backend build from repo root:

```bash
npm run build:api
```

## Known Pitfalls

- Railway path mismatch is a known failure source. Confirm deployment root paths before changing CI/deploy config.
- WebSocket and API URLs must be set correctly in environment variables.
- Keep Prisma/database assumptions out of frontend-only fixes.

## Environment Variables (Web)

Required for local/prod web behavior:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL` (optional fallback behavior may apply)

## Source Docs (Link, Do Not Duplicate)

- App overview and feature docs: [README.md](README.md)
- Backend API setup and contract context: [../api/README.md](../api/README.md)
- Deployment setup and troubleshooting: [../../AUTOMATIC-SETUP.md](../../AUTOMATIC-SETUP.md)
- Railway root-directory incident notes: [../../EMERGENCY-DEPLOY.md](../../EMERGENCY-DEPLOY.md)

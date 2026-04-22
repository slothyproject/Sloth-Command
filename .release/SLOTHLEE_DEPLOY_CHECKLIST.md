# Sloth Lee Theme Deploy Checklist

Date: 2026-04-22
Repository: central-hub-v3
Target URL: /auth/login -> /app/* dashboard flow

## Scope Files

- dashboard/templates/auth/login.html
- dashboard/static/css/main.css
- frontend/src/styles.css
- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/components/layout/Header.tsx
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/layout/MobileNav.tsx
- frontend/src/components/layout/Sidebar.tsx

## Validation Status

- Frontend build: PASSED (from implementation run)
- Backend tests via venv: PASSED (7 passed)
- Current note: flask-limiter warns about in-memory rate limit store in test environment

### 2026-04-22 Re-Validation

- Frontend build re-run in source workspace: PASSED
- Build command:

```powershell
cd e:\VSCODE\central-hub-v3\frontend
npm ci
npm run build
```

- Result summary:
   - tsc check passed
   - vite production build passed
   - output written to frontend/dist

- Isolation branch note:
   - clean branch `sloth-lee-theme-release` is based on `main`
   - `frontend/` appears as new content on that branch because it is not present on `main`

## Backend Validation Command

Run from repo root:

```powershell
e:/VSCODE/.venv/Scripts/python.exe -m pytest
```

Expected:

- 7 passed
- no failures

## Release Steps

1. Review patch bundle at .release/sloth-lee-theme.patch.
2. Apply or cherry-pick only listed scope files.
3. Re-run backend tests and frontend build in CI.
4. Deploy backend and frontend.
5. Smoke test:
   - /auth/login visual layout and CTA
   - mobile menu open/close and body scroll lock
   - /app dashboard hero, nav, and responsive behavior
6. Confirm no regressions in Discord OAuth login redirection.

## Post-Deploy Observability

- Check login conversion and auth error rates.
- Check 4xx/5xx trends on auth routes.
- Check frontend JS errors for mobile navigation interactions.

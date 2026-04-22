# PR Draft

## Title
feat(theme): Sloth Lee auth and dashboard visual rebuild with mobile nav

## Body
### Summary
This PR implements the Sloth Lee visual redesign for the live auth and dashboard flow used at /auth/login and /app routes.

### What changed
- Rebuilt Flask auth login shell visuals and copy.
- Updated auth CSS styling for Sloth Lee palette, ambient effects, and CTA treatment.
- Added mobile dashboard drawer navigation.
- Wired AppShell and Header mobile navigation controls and close behavior.
- Updated dashboard/login page content and brand framing in the frontend.
- Tuned frontend global styles for stronger Sloth Lee parity.

### Files in scope
- dashboard/templates/auth/login.html
- dashboard/static/css/main.css
- frontend/src/styles.css
- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/components/layout/Header.tsx
- frontend/src/components/layout/AppShell.tsx
- frontend/src/components/layout/MobileNav.tsx
- frontend/src/components/layout/Sidebar.tsx

### Validation
- Backend tests (venv): passed
  - command: e:/VSCODE/.venv/Scripts/python.exe -m pytest
  - result: 7 passed
- Frontend build (source workspace): passed
  - command: npm ci then npm run build in frontend
  - result: TypeScript check and Vite production build succeeded

### Risk and rollout
- Primary risk is visual regression on auth and responsive shell behavior.
- Rollout should include smoke checks on:
  - /auth/login render, CTA, and redirect flow
  - /app dashboard desktop and mobile navigation interactions
  - mobile menu open/close and body scroll lock

### Notes
- A clean release branch was prepared from main in a separate worktree and only the scoped files were staged there.
- Unrelated workspace modifications and restore folders were intentionally excluded from this release scope.

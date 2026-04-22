# Post-Merge Smoke Test Checklist

Use this checklist immediately after merging PR #4 and deploying.

## 1) Authentication Surface

- [ ] Open `/auth/login` and confirm Sloth Lee theme renders correctly.
- [ ] Confirm Discord sign-in button is visible and clickable.
- [ ] Confirm no layout shifts at common desktop widths (1366, 1440, 1920).
- [ ] Confirm mobile layout remains intact at 390x844.

## 2) Dashboard Core

- [ ] Open `/app/dashboard` and verify hero, stat cards, and operational panels render.
- [ ] Confirm right notification rail is sticky on desktop.
- [ ] Confirm sidebar is sticky and scroll-safe on desktop.
- [ ] Confirm mobile drawer opens, closes, and restores focus after close.

## 3) Interaction and Accessibility

- [ ] Press `Tab` from top of page and verify skip link appears.
- [ ] Confirm Escape closes mobile nav.
- [ ] Confirm notifications panel closes on outside click.
- [ ] Confirm reduced-motion preference does not break transitions.

## 4) Route Sanity

- [ ] Open `/app/tickets`.
- [ ] Open one ticket detail route from dashboard links.
- [ ] Open `/app/moderation`.
- [ ] Open `/app/analytics`.

## 5) Data and Live Status

- [ ] Confirm bot status chip appears and updates.
- [ ] Confirm empty-state messages appear when data lists are empty.
- [ ] Confirm loading skeletons appear before overview data resolves.

## 6) Regression Safety

- [ ] Confirm no console errors in dashboard shell on first load.
- [ ] Confirm no broken assets or 404 responses for static files.
- [ ] Confirm keyboard focus ring is visible on interactive controls.

## 7) Sign-off

- [ ] Smoke test completed by:
- [ ] Date/time:
- [ ] Environment:
- [ ] Notes:

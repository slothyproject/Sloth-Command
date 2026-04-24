# Repo Cleanup Audit

## Current state

This repo is the active public web surface for the platform. The current live
target is the Railway service `Sloth Command Dashboard`, which serves both the
homepage export and the authenticated dashboard.

## Active worktrees

| Path | Status | Keep? | Notes |
|------|--------|-------|-------|
| `E:\VSCODE\central-hub-v3` | Main working tree | Yes | Primary repo with ongoing changes |
| `E:\VSCODE\central-hub-v3.worktrees\hub-public-web` | Detached deploy worktree | Yes, for now | Clean deployment surface used to avoid shipping unrelated local changes |
| `E:\VSCODE\central-hub-v3.worktrees\verify-main-20260422-010819` | Feature worktree | Review before deleting | Older branch-specific shell; not needed for routine dashboard deploys |
| `E:\VSCODE\central-hub-v3-sloth-clean` | Separate branch worktree | Review before deleting | Contains older parallel cleanup effort and duplicated repo content |

## Legacy duplicate trees

| Path | Recommended action | Reason |
|------|--------------------|--------|
| `E:\VSCODE\_deploy_dash_tmp` | Deleted | Temporary deployment residue removed during cleanup |
| `E:\VSCODE\dissident-website-deploy` | Keep as source-only until homepage sync workflow is replaced | Still useful as the source export for `dashboard/static/homepage`, but no longer the primary public service |

## Homepage export cleanup

- Added a repeatable sync flow at `E:\VSCODE\railway-ops\refresh-hub-homepage-export.ps1`.
- The script now rebuilds the website export, syncs into `dashboard/static/homepage`,
  and prunes stale Next build manifest directories by inspecting exported metadata.
- Removed stale build directory `mnkc0titZILjMp6OcGCA9`.
- Current generated export still references multiple build IDs (`_iarL2zL9FNbmLZuoiy4U`,
  `mm71ylHbXkwCeWaRHpN4O`, and current build IDs from fresh export metadata), so only
  truly unreferenced dirs are pruned.

## Safe next cleanup actions

1. Replace the website export sync with a repeatable build-and-prune script so the homepage export only keeps one generation of manifests.
2. Retire `hub-public-web` once the main tree is clean enough to deploy directly.
3. Archive `verify-main-20260422-010819`, `central-hub-v3-sloth-clean`, and `_deploy_dash_tmp` after confirming no open work depends on them.

## Domain attachment status

- Attempted to attach `dissidenthub.mastertibbles.co.uk` to Railway service `Sloth Command Dashboard`.
- Blocked by Railway CLI auth state (`Unauthorized. Please run railway login again.`).
- Once authenticated, run:

```powershell
npx @railway/cli domain dissidenthub.mastertibbles.co.uk --service "Sloth Command Dashboard"
```
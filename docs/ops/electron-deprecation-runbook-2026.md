# Electron Deprecation Runbook (2026)

## Goal

Retire `apps/companion-desktop` after Tauri parity is verified and signed release artifacts are available.

## Preconditions

- Section G DoD completed for Tauri:
  - feature parity validated,
  - signed Windows/Linux artifacts produced,
  - fresh-machine install smoke passed.
- Stakeholder approvals:
  - engineering, security, operations.

## Execution Steps

1. Freeze Electron feature changes.
2. Switch default desktop docs/install links to Tauri artifacts.
3. Remove Electron from active CI build matrix.
4. Mark Electron package/app as legacy/deprecated in docs.
5. Keep emergency rollback branch/tag for Electron.
6. After one stable release cycle, remove Electron runtime package from main branch.

## Verification

- `scripts/electron-deprecation-check.cjs` reports no active Electron references in release docs/scripts.
- Desktop quickstart points only to Tauri installers.
- Release checklist Section Q updated and signed off.

# Desktop Tauri Phase 3: Electron Deprecation Controls (2026-02-13)

## Scope

Added executable deprecation controls for the legacy Electron desktop app while keeping final removal gated behind parity/signoff.

## Delivered

- Runbook:
  - `docs/ops/electron-deprecation-runbook-2026.md`
- Automated deprecation reference check:
  - `scripts/electron-deprecation-check.cjs`
  - `package.json` (`desktop:electron:deprecation:check`)
  - Status outputs:
    - `docs/release/status/electron-deprecation-check-latest.json`
    - `docs/release/status/electron-deprecation-check-latest.md`

## Validation

- `npm run desktop:electron:deprecation:check`

## Notes

- This phase provides enforcement and migration controls.
- Final Electron retirement remains blocked on Tauri parity + signed release completion.

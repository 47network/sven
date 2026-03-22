# Mobile UX Phase 7 Evidence (Section E - Version Matrix + Preflight)

Date: 2026-02-13
Scope: mobile runtime matrix enforcement + Windows/WSL preflight operability

## Implemented

- Locked and verified mobile architecture/runtime matrix through preflight checks:
  - Expo version
  - React Native version
  - Node major compatibility
- Added shell ops preflight entrypoint with WSL compatibility:
  - `scripts/ops/sh/mobile-preflight.sh`
  - Supports `powershell` and `powershell.exe` fallback from WSL.
- Added shell ops command wiring:
  - `sh scripts/ops/sh/ops.sh mobile preflight`
  - `sh scripts/ops/sh/ops.sh mobile newarch-check`

## Validation

- Windows preflight:
  - `npm run ops:mobile:preflight`
  - Result: pass
- WSL preflight:
  - `wsl sh -lc 'cd /mnt/x/47network/apps/openclaw-sven/sven_v0.1.0 && sh scripts/ops/sh/ops.sh mobile preflight'`
  - Result: pass
- New architecture check:
  - `npm run mobile:newarch:check`
  - Result: pass

## Artifacts

- `docs/release/status/mobile-preflight-latest.json`
- `docs/release/status/mobile-newarch-release-check.json`
- `docs/release/status/mobile-newarch-release-check.md`

## Notes

- This phase closes:
  - “Lock Expo/RN/Node version matrix and enforce with startup preflight checks.”
  - Mobile DoD: “Mobile preflight gate passes on Windows (PowerShell) and WSL workflows.”

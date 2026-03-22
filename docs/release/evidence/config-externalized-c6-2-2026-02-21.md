# Evidence: Config Externalization (C6.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.2`

## Scope

- Item: `All config externalized (no hardcoded values in code)`

## Implemented

- Added config externalization governance check:
  - `scripts/config-externalization-check.cjs`
  - Produces:
    - `docs/release/status/config-externalization-latest.json`
    - `docs/release/status/config-externalization-latest.md`
  - Enforces:
    - scoped env contract files exist (`config/env/dev.required.json`, `config/env/staging.required.json`, `config/env/prod.required.json`)
    - no hardcoded production domains in runtime source trees (`services/`, `apps/`, `packages/`, excluding tests/dist)
- CI integration:
  - `.github/workflows/env-secrets-governance.yml`
  - Added `Config externalization gate` step (strict mode).

## Remediation Applied

- Removed runtime hardcoded production URL fallback in gateway canvas share URL builder:
  - `services/gateway-api/src/routes/canvas.ts`
  - `PUBLIC_URL` now falls back to local dev URL (`http://localhost:3000`) rather than a production host.
- Removed hardcoded production endpoints in companion mobile onboarding presets:
  - `apps/companion-mobile/App.tsx`
  - Production gateways now come from config/env (`expo.extra` / `EXPO_PUBLIC_*`) rather than embedded domain literals.

## Validation

- Command run:
  - `node scripts/config-externalization-check.cjs --strict`
- Latest result:
  - `docs/release/status/config-externalization-latest.md` -> `Status: pass`

## Result

- Configuration governance now enforces externalization policy for runtime code paths and blocks hardcoded production endpoint drift.

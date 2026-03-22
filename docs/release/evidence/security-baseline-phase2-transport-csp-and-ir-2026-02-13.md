# Security Baseline Phase 2 Evidence

Date: 2026-02-13  
Scope: Section I hardening follow-up (`strict transport`, `CSP/sanitization`, `incident response playbook`).

## Implemented

- Gateway API:
  - Enabled strict helmet policy with CSP, HSTS, frameguard, referrer policy, and no-sniff.
  - Replaced permissive default CORS with explicit allowlist defaults (`*.47matrix.online`, localhost loopback).
  - File: `services/gateway-api/src/index.ts`

- Canvas UI:
  - Added DOMPurify sanitization before rendering A2UI HTML snapshots.
  - File: `apps/canvas-ui/src/app/c/[chatId]/page.tsx`
  - Dependency: `dompurify` in `apps/canvas-ui/package.json`

- Desktop Tauri CSP:
  - Tightened CSP to explicit Sven domains + localhost; removed wildcard `https://*`.
  - File: `apps/companion-desktop-tauri/src-tauri/tauri.conf.json`

- CI enforcement:
  - Added `scripts/security-transport-csp-check.cjs`
  - Added npm script: `security:transport:csp:check`
  - Added workflow step in `.github/workflows/security-baseline.yml`
  - Artifacts:
    - `docs/release/status/security-transport-csp-latest.json`
    - `docs/release/status/security-transport-csp-latest.md`

- Incident response:
  - Added runbook for token compromise and key rotation.
  - File: `docs/runbooks/security-token-compromise-and-key-rotation.md`

## Validation Commands

- `npm --prefix apps/canvas-ui install`
- `npm --prefix apps/canvas-ui run typecheck`
- `npm --prefix services/gateway-api run typecheck`
- `npm run security:transport:csp:check`

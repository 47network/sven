# Auth Bootstrap + Secure Storage Phase 1 (2026-02-13)

## Scope

Progress on Production Checklist Section C:
- Standardized session bootstrap on CLI via device login flow.
- Encrypted secret storage for CLI session artifacts.
- Hardened desktop token persistence fallback (encrypted at rest even when OS secure store is unavailable).
- Added plaintext secret leak heuristic gate for local release checks.

## Delivered

- CLI auth/session commands with encrypted local secret store:
  - `packages/cli/bin/sven.js`
  - `sven auth login-device`
  - `sven auth set-cookie`
  - `sven auth set-adapter-token`
  - `sven auth clear`
  - `sven auth status`
- Desktop secure storage fallback hardening:
  - `apps/companion-desktop/main.js`
- Plaintext secret heuristic scan:
  - `scripts/security-plaintext-secrets-check.cjs`
  - `package.json` (`security:plaintext:check`)

## Validation

- `node packages/cli/bin/sven.js --help | Select-String "sven auth"`
- `node packages/cli/bin/sven.js auth help`
- `node packages/cli/bin/sven.js auth status --json`
- `node packages/cli/bin/sven.js auth clear --json`
- `npm run security:plaintext:check`

All commands passed on 2026-02-13.

## Notes

- Tauri-native credential-vault implementation remains pending until the desktop migration target (`apps/companion-desktop-tauri`) is complete.

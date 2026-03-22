# Evidence: Secrets Separated from Config (C6.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.2`

## Scope

- Item: `Secrets separated from config (SOPS/age or Vault)`

## Implementation

- Scoped secret contracts are defined outside code for each environment:
  - `config/env/dev.required.json`
  - `config/env/staging.required.json`
  - `config/env/prod.required.json`
- CI/governance enforces secret handling via strict gate:
  - `scripts/env-secrets-management-check.cjs`
  - `.github/workflows/env-secrets-governance.yml`
  - npm command: `npm run release:config:secrets:separation:check`
- Runtime secret-provider hooks are implemented (Vault/SOPS capable):
  - `services/skill-runner/src/index.ts`
  - `services/notification-service/src/index.ts`
  - `docker-compose.yml` (`VAULT_ADDR`, `VAULT_TOKEN`, `SVEN_SOPS_BIN`)
- Secret reference resolution is supported for token-bearing integrations:
  - `services/gateway-api/src/services/GmailService.ts` (`GMAIL_ACCESS_TOKEN_REF`)

## Validation

- Command run:
  - `node scripts/env-secrets-management-check.cjs --strict`
- Status artifact:
  - `docs/release/status/env-secrets-management-latest.md`
- Current result: `Status: pass`
  - scoped secret contracts present
  - prod contract is a superset of staging
  - no tracked `.env` secrets files
  - workflows use `${{ secrets.* }}`
  - secrets inventory + key rotation runbook present
  - no suspicious secret leakage in release status artifacts

## Result

- Secret material is handled separately from static config and code paths, with Vault/SOPS runtime support plus CI policy enforcement.

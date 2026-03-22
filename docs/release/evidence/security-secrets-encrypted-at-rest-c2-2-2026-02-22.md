# C2.2 Secrets Encrypted At Rest (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Evidence Summary

Secret handling controls already implemented and evidenced under C6.2 are applicable here:

- Runtime secret-provider support:
  - Vault env hooks in deployment/runtime (`VAULT_ADDR`, `VAULT_TOKEN`)
  - SOPS binary support (`SVEN_SOPS_BIN`)
- CI policy/governance checks:
  - `.github/workflows/env-secrets-governance.yml`
  - `scripts/env-secrets-management-check.cjs`
- Secrets inventory and handling policy:
  - `docs/security/secrets-inventory-2026.md`

Primary prior evidence:

- `docs/release/evidence/secrets-separated-from-config-c6-2-2026-02-21.md`

## Note

This row is satisfied through encrypted secret stores and runtime injection model, not plaintext-on-disk config.

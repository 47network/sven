# Sven Release Status

This directory is for current generated status dashboards.

Interpretation rule:

- top-level `*latest*` files here are the active generated snapshots
- they support the current contract
- they do not replace canonical deploy, route, or operator docs

Use these first when you want current machine-generated state.

Do not use archived files or dated evidence here as the primary operator contract.

---

## Read In This Order

1. canonical docs:
   - [../../deploy/public-web-surface-routing-2026.md](../../deploy/public-web-surface-routing-2026.md)
   - [../../deploy/public-route-contract-and-auth-boundaries-2026.md](../../deploy/public-route-contract-and-auth-boundaries-2026.md)
2. current status artifacts in this directory
3. archived generated artifacts:
   - [archive/README.md](archive/README.md)
4. dated historical evidence:
   - [../evidence/README.md](../evidence/README.md)

---

## Scope Rule

Top-level files in this directory should be limited to:

- active `latest` dashboards
- current run-state files that back active gates
- current generated summaries needed by release verification

Superseded or host-specific generated `latest` files should move to `archive/`.

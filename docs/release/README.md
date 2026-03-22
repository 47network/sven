# Sven Release Docs

This directory mixes three different classes of material:

- canonical release guidance
- current machine-generated status dashboards
- historical evidence and archived artifacts

Do not treat every file in `docs/release/` as equal source of truth.

---

## Read In This Order

1. canonical contract and deploy docs:
   - [../deploy/public-web-surface-routing-2026.md](../deploy/public-web-surface-routing-2026.md)
   - [../deploy/public-route-contract-and-auth-boundaries-2026.md](../deploy/public-route-contract-and-auth-boundaries-2026.md)
   - [../deploy/setup-paths-matrix-2026.md](../deploy/setup-paths-matrix-2026.md)
2. release process docs in this directory:
   - [release-status.md](release-status.md)
   - [readiness-gates.md](readiness-gates.md)
   - [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
3. current dashboards:
   - [status/README.md](status/README.md)
4. historical policy and archive boundaries:
   - [historical-artifacts-and-evidence-policy-2026.md](historical-artifacts-and-evidence-policy-2026.md)
   - [evidence/README.md](evidence/README.md)

---

## Directory Rules

- `status/`:
  - current generated dashboards and active `latest` artifacts
- `status/archive/`:
  - deprecated-host or superseded generated artifacts
- `evidence/`:
  - dated proof, logs, captures, and audit history

If a dated artifact conflicts with a canonical deploy or route contract doc, the canonical doc wins.

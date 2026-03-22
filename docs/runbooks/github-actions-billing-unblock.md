# GitHub Actions Billing Unblock Runbook

Use this when workflows fail in 1-5 seconds with jobs that never start.

---

## Signal

Run:

```bash
npm run release:ci:billing:diagnose
```

Read:

- `docs/release/status/ci-billing-readiness-latest.json`
- `docs/release/status/ci-billing-readiness-latest.md`

Fail signature:

- `ci_billing_blocker_not_detected: fail`
- annotations containing:
  - "recent account payments have failed"
  - "spending limit needs to be increased"

---

## Unblock Steps

1. Open GitHub `Billing & plans` for the org/account that owns `47network/thesven`.
2. Resolve failed payment method or increase Actions spending limit.
3. Re-run a lightweight workflow (`deployment-pipeline`) and confirm jobs actually start.
4. Re-run release gate sync workflow after billing is fixed.

---

## Post-Unblock Verification

Run in order:

```bash
npm run release:ci:billing:diagnose
npm run release:ci:required:check:local
npm run release:parity:checklist:verify
```

Expected:

- `ci-billing-readiness-latest.json`: `status=pass`
- required checks local artifact no longer needs local-only overrides for live workflows
- parity checklist remains blocked only by explicit soak/lifecycle gates until soak promotion


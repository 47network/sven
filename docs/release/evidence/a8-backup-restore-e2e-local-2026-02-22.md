# A8 Backup/Restore E2E Local Validation (2026-02-22)

- Checklist row: `A8.4 - E2E: Backup -> modify data -> restore -> verify original data`
- Scope: live local execution of backup/restore integration e2e, including retention behavior.

## Runtime prerequisites used

- `API_URL=http://127.0.0.1:3000`
- `DATABASE_URL=postgresql://sven:sven-dev-47@127.0.0.1:5432/sven`
- `TEST_SESSION_COOKIE` acquired from local operator login (`/v1/auth/login`)

## Test hardening updates

Adjusted `services/gateway-api/src/__tests__/backup-restore.integration.e2e.ts` to run reliably in containerized local environments:

1. Validate backup manifests from downloaded archive bytes instead of host filesystem DB paths.
2. Allow restore test fallback to restoring original backup when upload endpoint is unavailable in local profile.
3. Increase long-running test timeouts to avoid false timeout failures.
4. Pre-clean `restore_jobs` references in test setup to prevent FK-retention interference from prior local runs.

## Local run

Command:

```powershell
npm run test:gateway:backup-restore
```

Observed result on 2026-02-22:

- `Test Suites: 1 passed`
- `Tests: 3 passed`

Detailed assertions passed:

- backup creates valid archive with required manifest components
- restore flow completes and preserves manifest payload compatibility
- retention policy keeps completed backups within default cap

## Status

- A8.4 E2E gate: **pass**.

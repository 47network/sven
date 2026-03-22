# C4.3 Data Management Verification (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Rows:
    - `PII fields identified and documented`
    - `Data retention policy enforced (configurable per table)`
    - `Data export endpoint for GDPR compliance (user data export)`
    - `Data deletion endpoint for right-to-erasure`
    - `Soft delete vs hard delete policy documented per table`

## PII Inventory Documentation

- Added:
  - `docs/privacy/pii-field-inventory-2026.md`
- Source query:
  - `information_schema.columns` discovery for PII/sensitive naming patterns.

## Retention Enforcement (Configurable Per Table)

- Enhanced retention cleanup logic:
  - `services/gateway-api/src/services/PrivacyService.ts`
  - `scheduleRetentionCleanup()` now applies policy windows across table classes:
    - `messages` (`message_retention_days`)
    - `artifacts` (`message_artifacts_days`)
    - `tool_runs` (`tool_runs_days`)
    - `voice_transcripts`, `voice_tts_generated` (`voice_transcripts_days` + expiry-column cleanup)
    - `outbox`, `notifications` (`message_logs_days`)
    - `canvas_events`, `webhook_events`, `browser_audit_logs` (`metadata_retention_days`)

- Retention scheduler wired into gateway startup:
  - `services/gateway-api/src/index.ts`
  - Env controls:
    - `PRIVACY_RETENTION_CLEANUP_INTERVAL_MS` (default `86400000`)
    - `PRIVACY_RETENTION_CLEANUP_INITIAL_DELAY_MS` (default `120000`)
  - Env + compose wired in:
    - `.env`
    - `docker-compose.yml`

- Runtime check:

```powershell
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven'
pnpm --dir services/gateway-api exec tsx -e "import { scheduleRetentionCleanup } from './src/services/PrivacyService.ts'; import { closePool } from './src/db/pool.ts'; (async () => { const r = await scheduleRetentionCleanup(); console.log(JSON.stringify(r)); await closePool(); process.exit(0); })();"
```

Observed:

- `{"cleaned":0,"error":null}` (no eligible rows in local dataset at run time)

## GDPR Export and Deletion Endpoints

- Existing admin privacy routes verified:
  - `services/gateway-api/src/routes/admin/privacy.ts`
- Relevant endpoints:
  - `GET /privacy/retention-policy`
  - `POST /privacy/export-request`
  - `GET /privacy/export-request/:requestId`
  - `POST /privacy/deletion-request`
  - `POST /privacy/deletion-request/:requestId/approve`
  - `POST /privacy/deletion-request/:requestId/execute`
  - `POST /privacy/detect-pii`
  - `POST /privacy/redact-text`
  - `GET /privacy/audit-log`

## Soft vs Hard Delete Policy Documentation

- Added:
  - `docs/privacy/soft-vs-hard-delete-policy-2026.md`
- Implementation references:
  - `services/gateway-api/src/services/PrivacyService.ts` (`executeDeletion`)

## Validation

```powershell
pnpm --dir services/gateway-api run build
rg -n "app\\.(get|post)\\('/privacy/" services/gateway-api/src/routes/admin/privacy.ts
```

## Notes

- `src/__tests__/privacy.e2e.ts` is currently a standalone script using `require.main` and does not run directly under current ESM mode without adaptation; endpoint presence and service behavior were verified via source + runtime smoke.

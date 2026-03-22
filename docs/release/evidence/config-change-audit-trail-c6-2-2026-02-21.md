# Evidence: Config Change Audit Trail (C6.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C6.2`

## Scope

- Item: `Config change audit trail`

## Implementation

- Added persistent audit table for config mutations:
  - `services/gateway-api/src/db/migrations/113_config_change_audit.sql`
- Extended admin settings route to write audit records on every setting update:
  - `services/gateway-api/src/routes/admin/settings.ts`
  - Captured fields: `organization_id`, `key`, `old_value`, `new_value`, `changed_at`, `changed_by`, `changed_by_user_id`, `source_ip`, `user_agent`
- Added audit retrieval endpoint:
  - `GET /v1/admin/settings/audit`
  - Optional filters: `key`, `limit`
- Added release validation gate:
  - `scripts/config-audit-trail-check.cjs`
  - npm command: `npm run release:config:audit:check`
  - CI wiring: `.github/workflows/env-secrets-governance.yml`

## Validation

- Command run:
  - `node scripts/config-audit-trail-check.cjs --strict`
- Status artifact:
  - `docs/release/status/config-audit-trail-latest.md`
- Current result: `Status: pass`
  - migration exists
  - settings route writes audit entries
  - settings audit endpoint exposed

## Result

- Config changes now have a queryable audit trail with actor and request context, suitable for production governance and incident forensics.

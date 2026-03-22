# C4.1 Migration Naming Convention Enforcement (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Migration naming convention enforced (timestamp prefix)`

## Implemented

- Added migration naming gate script:
  - `scripts/db-migration-naming-check.cjs`
- Added root npm command:
  - `package.json`
  - `release:db:migration:naming:check`
- Added legacy migration allowlist for controlled transition:
  - `services/gateway-api/src/db/migrations-legacy-allowlist.json`

## Enforcement Rule

- Required format for non-allowlisted files:
  - `YYYYMMDDHHMMSS_slug.sql`
  - Regex: `^\d{14}_[a-z0-9_]+\.sql$`
- Timestamp-prefix duplicates are rejected for timestamp-based files.
- Existing legacy files are explicitly grandfathered via allowlist.
- Any new migration not in allowlist must use timestamp prefix format.

## Validation

```powershell
node scripts/db-migration-naming-check.cjs
npm run release:db:migration:naming:check
```

Result:

- `db-migration-naming-check: PASS (118 total; 0 timestamp-named; 118 legacy-allowlisted)`

## Notes

- This enforces timestamp-prefix naming for all new migrations while preserving compatibility with the existing migration history.

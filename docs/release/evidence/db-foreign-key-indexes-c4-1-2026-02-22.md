# C4.1 Foreign Key Index Verification (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Foreign key indexes verified for all join columns`

## Implemented

- Added automatic FK-index migration:
  - `services/gateway-api/src/db/migrations/20260222160000_fk_auto_indexes.sql`
- Added follow-up correction migration for already-applied environments:
  - `services/gateway-api/src/db/migrations/20260222162000_fk_auto_indexes_followup.sql`
- Added rollback scripts:
  - `services/gateway-api/src/db/rollbacks/20260222160000_fk_auto_indexes.sql`
  - `services/gateway-api/src/db/rollbacks/20260222162000_fk_auto_indexes_followup.sql`

## Validation Commands

1. Build + migration checks:

```powershell
pnpm --dir services/gateway-api run build
node scripts/db-migration-naming-check.cjs
pnpm --dir services/gateway-api run db:rollback:check
```

2. Apply migrations locally:

```powershell
$env:DATABASE_URL='postgresql://sven:sven-dev-47@localhost:5432/sven'
pnpm --dir services/gateway-api run db:migrate
```

3. FK coverage audit (correct `pg_index.indkey` matcher):

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d sven -t -A -c "WITH fk AS ( SELECT c.oid AS constraint_oid, n.nspname AS schema_name, cl.relname AS table_name, c.conname AS constraint_name, c.conrelid, c.conkey FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace WHERE c.contype='f' AND n.nspname NOT IN ('pg_catalog','information_schema') AND cl.relkind IN ('r','p') ), missing AS ( SELECT fk.* FROM fk WHERE NOT EXISTS ( SELECT 1 FROM pg_index i WHERE i.indrelid = fk.conrelid AND i.indisvalid AND i.indpred IS NULL AND i.indnkeyatts >= cardinality(fk.conkey) AND NOT EXISTS ( SELECT 1 FROM generate_subscripts(fk.conkey, 1) AS s(pos) WHERE i.indkey[s.pos - 1] <> fk.conkey[s.pos] ) ) ) SELECT count(*) FROM missing;"
```

4. Spot-check missing list:

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d sven -P pager=off -c "WITH fk AS ( SELECT c.oid AS constraint_oid, n.nspname AS schema_name, cl.relname AS table_name, c.conname AS constraint_name, c.conrelid, c.conkey FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace WHERE c.contype='f' AND n.nspname NOT IN ('pg_catalog','information_schema') AND cl.relkind IN ('r','p') ), missing AS ( SELECT fk.* FROM fk WHERE NOT EXISTS ( SELECT 1 FROM pg_index i WHERE i.indrelid = fk.conrelid AND i.indisvalid AND i.indpred IS NULL AND i.indnkeyatts >= cardinality(fk.conkey) AND NOT EXISTS ( SELECT 1 FROM generate_subscripts(fk.conkey, 1) AS s(pos) WHERE i.indkey[s.pos - 1] <> fk.conkey[s.pos] ) ) ) SELECT schema_name, table_name, constraint_name FROM missing ORDER BY schema_name, table_name, constraint_name LIMIT 20;"
```

## Results

- Migration naming check: pass (`120 total; 2 timestamp-named; 118 legacy-allowlisted`).
- Rollback coverage check: pass (`120/120 migrations have rollback SQL`).
- FK audit result: `0` missing FK indexes.
- Spot-check query: `(0 rows)`.

## Notes

- The first migration created broad FK coverage.
- The follow-up migration closes edge cases where a FK column appeared only in non-leading position of composite indexes.

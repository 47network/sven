# Dormant migration archive — DO NOT POINT THE LOADER HERE

This directory contains 1,917 SQL files that were generated en masse by historical
"batches" feature work but were **never applied** to any environment and have
**never been referenced** by runtime code.

## Provenance

These files were originally placed at `services/gateway-api/migrations/` — a
location that is **not** in the candidate path list of the gateway-api migration
loader (`services/gateway-api/src/db/migrate.ts`, `candidates` array, ~line 152).

The loader scans only:
- `services/gateway-api/src/db/migrations/` (canonical)
- `dist/db/migrations/` (built output)

So although these files were committed to git, they were silently skipped at boot.
That was their effective state for the entire history of this codebase.

## Audit (2026-04-20)

A full audit before quarantining confirmed:

- **Pattern**: every file is a template-generated `CREATE TABLE agent_<name>_configs`
  with a JSONB `config` column. Hundreds of variants like
  `agent_<feature>_monitor`, `_auditor`, `_reporter`, `_optimizer`.
- **Runtime references**: `grep -r` across `services/`, `apps/`, `packages/`
  excluding `__tests__` returned **zero hits** for the table names.
- **DB state on VM4**: not a single one of these tables exists in production.
  Verified via `pg_tables` query.
- **Applied migrations**: VM4 `_migrations` table has 208 entries, all of which
  come from `services/gateway-api/src/db/migrations/`. None come from this dir.

## Why archive instead of delete

1. **Audit trail** — preserve what was generated, in case any of it later needs review.
2. **Safe by default** — sitting under `migrations.archive-dormant/` it cannot
   be picked up by the loader's candidate-dir scan.
3. **Cheap** — 8 MB on disk, free in git via rename.

## If you want to reactivate any of these

Do not bulk-move them back. Instead:

1. Pick a single migration file you actually need.
2. Audit the SQL by hand against current schema.
3. Rename it with the next sequential timestamp prefix.
4. Move it into `services/gateway-api/src/db/migrations/`.
5. Test locally first, then deploy.

## Loader behaviour caveat

The loader picks the candidate directory with the **most** `.sql` files
(`sort((a,b) => b.files.length - a.files.length)`). If anyone ever puts
this dir back into the candidate list, it would replace the canonical
209-file directory and silently apply all 1,917 dormant migrations — which
would corrupt the schema. Don't do that.

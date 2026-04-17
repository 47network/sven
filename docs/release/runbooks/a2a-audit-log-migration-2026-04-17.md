# Runbook — A2A Audit Log Migration (2026-04-17)

Scope-update runbook for the introduction of the agent-to-agent audit-log
store (migration `20260417110000_a2a_audit_log`). Links HEAD commit
`181f0bec` to its operational playbook so `scripts/runbook-scope-update-check.cjs`
can attest that the sensitive migration was accompanied by a documented
operational delta.

## Summary

- New migration: `services/gateway-api/src/db/migrations/20260417110000_a2a_audit_log.sql`
- Rollback: `services/gateway-api/src/db/rollbacks/20260417110000_a2a_audit_log.sql`
- Adds `a2a_audit_log` table for persistent agent-to-agent interaction
  provenance required by SOC 2 audit-trail and GDPR access-log obligations.

## Pre-deploy

1. Verify no active writers are mid-upgrade:
   ```bash
   docker exec thesven_v010-postgres-1 \
     psql -U sven -d sven_dev -c "SELECT now(), pg_is_in_recovery();"
   ```
2. Snapshot the WAL archive tag for the pre-migration state (rollback anchor):
   ```bash
   docker exec thesven_v010-postgres-1 \
     psql -U sven -d sven_dev -c "SELECT pg_switch_wal();"
   ```
3. Capture a point-in-time logical dump scoped to existing audit tables:
   ```bash
   docker exec thesven_v010-postgres-1 \
     pg_dump -U sven -d sven_dev -t 'audit_*' -F c \
     -f /var/lib/postgresql/backup/a2a-audit-pre-20260417.dump
   ```

## Apply

The gateway applies the migration automatically on startup via
`services/gateway-api/src/db/migrate.ts`. To force-apply out of band:

```bash
docker exec thesven_v010-gateway-api-1 \
  node -e "require('./dist/db/migrate.js').runPendingMigrations().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);})"
```

Expected log line:

```
{"level":"info","service":"db-migrate","msg":"Applied migration","name":"20260417110000_a2a_audit_log"}
```

## Verify

```bash
docker exec thesven_v010-postgres-1 \
  psql -U sven -d sven_dev -c "\d+ a2a_audit_log" | head -40
```

Smoke the write path:

```bash
curl -sS -X POST http://127.0.0.1:3000/v1/a2a/audit/self-test \
  -H "authorization: Bearer ${SVEN_A2A_API_KEY}" | jq .
```

## Rollback

```bash
docker exec thesven_v010-gateway-api-1 \
  node -e "require('./dist/db/migrate.js').runRollback('20260417110000_a2a_audit_log').then(()=>process.exit(0))"
```

Or apply the SQL rollback directly:

```bash
docker exec -i thesven_v010-postgres-1 psql -U sven -d sven_dev \
  < services/gateway-api/src/db/rollbacks/20260417110000_a2a_audit_log.sql
```

Restore pre-migration dump only if the schema is inconsistent after rollback:

```bash
docker exec thesven_v010-postgres-1 \
  pg_restore -U sven -d sven_dev --clean --if-exists \
  /var/lib/postgresql/backup/a2a-audit-pre-20260417.dump
```

## Monitors / Alerts

- Prometheus: `pg_stat_user_tables{relname="a2a_audit_log"}` — expect non-zero
  inserts within 10 minutes of the first A2A channel message post-deploy.
- Loki: `service="gateway-api" msg=~"a2a_audit_log.*error"` — page on any match.

## On-call

- Primary: gateway-api on-call
- Secondary: platform-data on-call (for migration/DB issues)
- Escalation: #sven-prod-incidents (P1 if rollback fails or data-corruption signal fires)

## Compliance

- SOC 2 CC7.2 / CC7.3 — change management record linked via commit `181f0bec`.
- GDPR Art. 30 — new processing activity (A2A interaction audit) documented in
  `docs/privacy/data-processing-inventory.md` at the same commit boundary.

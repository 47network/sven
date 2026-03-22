# C4.1 Query Performance Validation (>100k Rows) (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Query performance validated for tables > 100k rows (EXPLAIN ANALYZE)`

## Commands Run

1. Identify largest user tables:

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d sven -P pager=off -c "SELECT schemaname, relname AS table_name, n_live_tup::bigint AS est_rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20;"
```

2. Explicit threshold check:

```powershell
docker exec sven_v010-postgres-1 psql -U sven -d sven -P pager=off -c "SELECT schemaname, relname AS table_name, n_live_tup::bigint AS est_rows FROM pg_stat_user_tables WHERE n_live_tup >= 100000 ORDER BY n_live_tup DESC;"
```

## Results

- Largest table estimate in this local environment: `_migrations` with `118` rows.
- Tables at or above `100000` rows: none (`0 rows`).

## Conclusion

- There are no tables in the local runtime requiring `>100k` EXPLAIN ANALYZE validation at this time.
- Threshold audit is recorded and repeatable via the commands above.

# C4.1 Vacuum/Analyze Scheduling (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Scope

- Checklist target:
  - `docs/release/checklists/sven-production-parity-checklist-2026.md`
  - Row: `Vacuum/analyze scheduled`

## Implemented

- Added scheduled maintenance sidecar:
  - `docker-compose.yml`
  - Service: `postgres-maintenance`
  - Runs: `vacuumdb -h postgres -U ${POSTGRES_USER} --all --analyze-in-stages --jobs=2`
  - Schedule loop:
    - initial delay: `POSTGRES_MAINTENANCE_INITIAL_DELAY_SECONDS` (default `300`)
    - interval: `POSTGRES_MAINTENANCE_INTERVAL_SECONDS` (default `86400`)
- Added environment knobs:
  - `.env`
  - `POSTGRES_MAINTENANCE_INTERVAL_SECONDS=86400`
  - `POSTGRES_MAINTENANCE_INITIAL_DELAY_SECONDS=300`

## Validation

1. Compose config includes service:

```powershell
docker compose config --services
```

2. Runtime smoke test with short initial delay:

```powershell
$env:POSTGRES_MAINTENANCE_INITIAL_DELAY_SECONDS='0'
$env:POSTGRES_MAINTENANCE_INTERVAL_SECONDS='600'
docker compose up -d postgres-maintenance
docker logs --tail 20 sven_v010-postgres-maintenance-1
```

Observed log output included:

- `vacuumdb: processing database "sven": Generating minimal optimizer statistics (1 target)`
- `vacuumdb: processing database "sven": Generating medium optimizer statistics (10 targets)`
- `vacuumdb: processing database "sven": Generating default (full) optimizer statistics`

3. Restored default schedule values by reapplying compose with `.env` values:

```powershell
docker compose up -d postgres-maintenance
docker inspect sven_v010-postgres-maintenance-1 --format "{{range .Config.Env}}{{println .}}{{end}}" | rg "POSTGRES_MAINTENANCE|POSTGRES_USER"
```

Result:

- `POSTGRES_MAINTENANCE_INITIAL_DELAY_SECONDS=300`
- `POSTGRES_MAINTENANCE_INTERVAL_SECONDS=86400`
- `POSTGRES_USER=sven`

## Conclusion

- Automated vacuum/analyze scheduling is enabled and configurable for production tuning.

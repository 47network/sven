# Failure Mode Results

## Scope

This document records C1.2 drills:

- PostgreSQL connection pool exhaustion
- NATS disconnect and replay
- OpenSearch outage with RAG degrade behavior
- LLM provider outage and fallback routing
- Disk full behavior and alerting
- OOM restart and service recovery

## Runner

- Script: `scripts/failure-mode-check.cjs`
- Outputs:
- `docs/release/status/failure-mode-latest.json`
- `docs/release/status/failure-mode-latest.md`

## Run Command

```bash
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Environment Command Contract

For each scenario, set these environment variables:

- `<PREFIX>_INDUCE_CMD`
- `<PREFIX>_VERIFY_DEGRADED_CMD`
- `<PREFIX>_RECOVER_CMD`
- `<PREFIX>_VERIFY_RECOVERED_CMD`

Scenario prefixes:

- `FM_POSTGRES`
- `FM_NATS`
- `FM_OPENSEARCH`
- `FM_LLM`
- `FM_DISK`
- `FM_OOM`

Example (PowerShell):

```powershell
$env:FM_NATS_INDUCE_CMD = "docker compose stop nats"
$env:FM_NATS_VERIFY_DEGRADED_CMD = "node scripts/release-status.js --check nats-degraded"
$env:FM_NATS_RECOVER_CMD = "docker compose start nats"
$env:FM_NATS_VERIFY_RECOVERED_CMD = "node scripts/release-status.js --check nats-recovered"
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Evidence Table

| Scenario | Expected | Result | Evidence |
|---|---|---|---|
| PostgreSQL pool exhaustion | Graceful degradation, no crash loop | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-postgres-pool-2026-02-21.md` |
| NATS disconnect | Reconnect and replay | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-nats-disconnect-2026-02-21.md` |
| OpenSearch down | RAG degrade fallback works | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-opensearch-rag-degrade-2026-02-21.md` |
| LLM provider down | Fallback provider selected | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-llm-provider-failover-2026-02-21.md` |
| Disk full | Alerting and stable control plane | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-disk-full-2026-02-21.md` |
| OOM restart | Process/container recovers cleanly | passed (2026-02-21) | `docs/release/status/failure-mode-latest.*`, `docs/release/evidence/failure-mode-oom-restart-2026-02-21.md` |

## Notes

- This file is the canonical C1.2 results location required by the release checklist.
- Mark scenario checklist rows complete only after command-backed evidence is captured.

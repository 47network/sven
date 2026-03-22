# C3.4 Logging Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Structured JSON Logging

- Shared logger emits JSON log lines with structured fields:
  - `level`, `ts`, `service`, `msg`, plus extra metadata.
- Source:
  - `packages/shared/src/logger.ts`
- Services consistently instantiate logger via `createLogger('<service-name>')`.

## Log Level Configurability

- Implemented environment-driven threshold filtering in shared logger:
  - `LOG_LEVEL` supports `debug|info|warn|error|fatal`
  - Messages below configured threshold are dropped.
- Source:
  - `packages/shared/src/logger.ts`
- Build validation:
  - `pnpm --dir packages/shared run build` -> pass

## Correlation IDs

- Implemented cross-service correlation-id propagation for primary request/tool execution paths:
  - Gateway assigns `request.correlationId` from `x-correlation-id` when valid, otherwise falls back to `request.id`.
  - Gateway echoes `x-correlation-id` in every response.
  - Gateway injects `metadata.correlation_id` into inbound NATS events published by:
    - adapter routes (`/v1/events/message|file|audio`)
    - canvas routes (chat send, nudge replay, A2UI interaction bridge)
    - webhook/email `agent_message` handlers
  - Agent runtime reads inbound `metadata.correlation_id` and propagates it on `tool.run.request` as `data.correlation_id`.
  - Skill runner copies `tool.run.request.data.correlation_id` into `tool.run.result.data.correlation_id`.
  - Self-correction retries preserve correlation id on re-issued tool runs.
- Source:
  - `services/gateway-api/src/lib/correlation.ts`
  - `services/gateway-api/src/index.ts`
  - `services/gateway-api/src/routes/adapter.ts`
  - `services/gateway-api/src/routes/canvas.ts`
  - `services/gateway-api/src/routes/email.ts`
  - `services/gateway-api/src/routes/webhooks.ts`
  - `services/agent-runtime/src/index.ts`
  - `services/agent-runtime/src/self-correction.ts`
  - `services/skill-runner/src/index.ts`
  - `packages/shared/src/types/events.ts`

### Validation

- Local compile checks:
  - `pnpm --dir services/gateway-api run build` -> pass
  - `pnpm --dir services/agent-runtime run build` -> pass
  - `pnpm --dir services/skill-runner run build` -> pass
- Local unit test:
  - `pnpm --dir services/gateway-api run test -- --runTestsByPath src/__tests__/correlation.unit.test.ts` -> pass (`3 passed`)

## Sensitive Data Redaction

- Shared logger includes built-in redaction for:
  - sensitive keys (`password`, `token`, `secret`, `api_key`, `authorization`, `cookie`, etc.)
  - sensitive string patterns (email addresses, JWTs, bearer tokens, common API key formats)
- Runtime-configurable custom redaction patterns are supported via:
  - `LOGGING_REDACT_SENSITIVE`
  - `LOGGING_REDACT_PATTERNS`
- Source:
  - `packages/shared/src/logger.ts`
  - `services/gateway-api/src/db/migrations/107_logging_redaction_settings.sql`
- Local test validation:
  - `pnpm --dir services/gateway-api run test -- --runTestsByPath src/__tests__/logger-redaction.unit.test.ts` -> pass

## Log Retention Policy (30d hot + 90d cold, configurable)

- Implemented configurable **hot retention** in Loki:
  - `config/loki-config.yml`
    - `limits_config.retention_period: ${LOKI_HOT_RETENTION_PERIOD}`
    - `compactor.retention_enabled: true`
  - `docker-compose.yml` (loki service):
    - `-config.expand-env=true`
    - env: `LOKI_HOT_RETENTION_PERIOD=${LOKI_HOT_RETENTION_PERIOD:-720h}`
- Implemented configurable **cold retention** archive path:
  - `docker-compose.yml` adds `loki-cold-archive` service (profile `monitoring-logs`)
    - creates periodic compressed snapshots from `/loki` into `/archive`
    - prunes snapshots older than `LOKI_COLD_RETENTION_DAYS` (default `90`)
    - interval configurable via `LOKI_COLD_ARCHIVE_INTERVAL_SECONDS` (default `86400`)
  - Added persistent archive volume:
    - `loki-archive` (`sven-loki-archive`)
- Environment defaults:
  - `.env`
    - `LOKI_HOT_RETENTION_PERIOD=720h` (30 days)
    - `LOKI_COLD_RETENTION_DAYS=90`
    - `LOKI_COLD_ARCHIVE_INTERVAL_SECONDS=86400`

### Validation

- `docker compose --profile monitoring-logs config` -> pass (compose config valid).
- `docker compose --profile monitoring-logs up -d loki loki-cold-archive`:
  - blocked in this environment due to host port conflict on `:3100` (existing listener), not config error.

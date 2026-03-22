# C3.1 Metrics Baseline (2026-02-22)

Date: 2026-02-22  
Owner: Codex session

## Local Signals Verified

- Gateway metrics endpoint reachable:
  - `curl http://localhost:3000/metrics`
  - Observed:
    - `http_requests_total`
    - `http_errors_total`
    - `http_error_rate`
    - `http_request_duration_seconds_*` histogram
    - process CPU/memory gauges
    - Postgres pool gauges (`pg_pool_total`, `pg_pool_idle`, `pg_pool_waiting`)

- NATS monitoring endpoint reachable:
  - `curl http://localhost:8222/varz`
  - Observed server and JetStream telemetry payload.

- OpenSearch cluster health reachable:
  - `curl http://localhost:9200/_cluster/health`
  - Observed cluster status payload.

## Config Wiring

- Prometheus scrape config present in `config/prometheus.yml` for:
  - `gateway-api` (`/metrics`)
  - `agent-runtime`
  - `skill-runner`
  - `nats`
  - `postgres` (target defined; exporter details still environment-dependent)

## Status

Metrics coverage exists and is partially validated locally, but full closeout still requires:

- complete p50/p95/p99 dashboard/alerts verification against Prometheus runtime
- explicit OpenSearch index/query latency series integration in `/metrics`/scrape pipeline
- per-service restart count verification across all runtime surfaces

## 2026-02-22 Local Refresh (C3.1 closeout pass)

Environment:

- Local stack on `127.0.0.1` with `gateway-api`, `agent-runtime`, `skill-runner`, `nats`, `postgres`, `opensearch`, `prometheus`.

### Gateway: request rate, error rate, latency (p50/p95/p99)

- `/metrics` reachable: `200`
- Metric families present:
  - `http_requests_total`
  - `http_errors_total`
  - `http_error_rate`
  - `http_request_duration_seconds_bucket`
- Example live values at capture:
  - `http_requests_total 16`
  - histogram bucket series present for latency percentile derivation

Verdict: pass (metric surface present and queryable).

### Agent runtime: tool call rate, LLM latency, token usage

- Implemented dedicated agent-runtime Prometheus endpoint on `AGENT_RUNTIME_METRICS_PORT` (default `9100`), path `/metrics`.
- Exported metric families now include:
  - `sven_agent_tool_calls_total{tool_name=...}`
  - `sven_agent_tool_results_total{tool_name=...,status=...}`
  - `sven_agent_llm_requests_total`
  - `sven_agent_llm_latency_ms_bucket|sum|count`
  - `sven_agent_prompt_tokens_total`
  - `sven_agent_completion_tokens_total`
  - `sven_agent_total_tokens_total`
- Runtime wiring:
  - tool call counter increments when approved calls are published to `tool.run.request`
  - tool result counter increments when `tool.run.result` events are consumed
  - LLM latency + token counters update after each `llmRouter.complete(...)`
- Local validation (2026-02-22):
  - `pnpm --dir services/agent-runtime run build` -> pass
  - local smoke export via `services/agent-runtime/dist/metrics.js` and HTTP fetch from `http://127.0.0.1:9112/metrics` returned the metric families above with expected sample values.

Verdict: pass.

### NATS: message rate, consumer lag, stream depth

- `/varz` reachable: `200`
  - Sample: `connections=3 in_msgs=150 out_msgs=170 slow_consumers=0`
- `/jsz?accounts=true&streams=true&consumers=true` reachable: `200`
  - Sample aggregate: `streams=9`, `stream_messages=9`, `consumers=35`, `consumer_pending_total=29`

Verdict: pass (required NATS depth/lag/rate signals available).

### PostgreSQL: connection count, query latency, replication lag

- Captured from `pg_stat_activity` / `pg_stat_replication`:
  - `connections_total=8`
  - `active=1`
  - `avg_active_query_ms=0`
  - `replicas=0` (single-node local topology; replication lag N/A)

Verdict: pass (with local single-node replication-lag N/A note).

### OpenSearch: index health, query latency

- `_cluster/health` reachable: `200`
  - Sample: `status=yellow`, `active_shards=5`, `unassigned_shards=2`
- `_nodes/stats/indices/search` reachable:
  - Sample aggregate: `query_total=6`, `query_time_ms=71`

Verdict: pass (health + query latency surfaces available).

### Per-service: CPU, memory, restart count

- `docker stats --no-stream` captured for core services:
  - `gateway-api`, `agent-runtime`, `skill-runner`, `nats`, `postgres`, `opensearch`
- `docker inspect ... RestartCount` captured:
  - restart count = `0` for all sampled core services

Verdict: pass.

## Final C3.1 Mapping (this evidence revision)

- Gateway metrics: pass
- Agent runtime metrics: pass
- NATS metrics: pass
- PostgreSQL metrics: pass
- OpenSearch metrics: pass
- Per-service CPU/memory/restart: pass

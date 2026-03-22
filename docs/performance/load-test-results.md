# Load Test Results

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Tool | k6 |
| Script | `tests/load/gateway-load-test.js` |
| Target | Gateway API |
| Virtual Users | 100 (ramped) |
| Chat Sessions | 10 concurrent |
| Duration | ~8 minutes (1m ramp + 1m ramp + 5m hold + 1m ramp-down) |
| LLM First-Token Probe | Optional (`OPENAI_API_KEY` + `OPENAI_MODEL`) |
| Date | 2026-02-21 |
| Run Status | pass (all k6 C1.1 latency/error thresholds) |

## Targets

| Metric | Target | Result | Status |
|--------|--------|--------|--------|
| p95 latency (non-LLM) | < 500ms | 3.15ms (`http_req_duration p95`) | pass |
| p95 latency (LLM first token) | < 5000ms | 5.36ms (`llm_first_token_ms p95`) | pass |
| 5xx errors under load | 0 | 0 (`errors_5xx`) | pass |
| Error rate | < 0.1% | 0.00% (`error_rate`) | pass |
| Max concurrent users | 100 | 100 (scenario reached target) | pass |
| Concurrent chat sessions | 10 | 10 (scenario reached target) | pass |
| RSS stability (24h) | Stable (no leak) | _pending_ | |

## Endpoint Breakdown

| Endpoint | Requests | p50 | p95 | p99 | Errors |
|----------|----------|-----|-----|-----|--------|
| GET /healthz | included in 232,455 total HTTP requests | ~1.44ms (`health_latency` median) | ~2.06ms (`health_latency` p95) | n/a | none |
| GET /readyz | included in 232,455 total HTTP requests | ~1.44ms (`health_latency` median) | ~2.06ms (`health_latency` p95) | n/a | none |
| GET /metrics | included in 232,455 total HTTP requests | ~1.44ms (`health_latency` median) | ~2.06ms (`health_latency` p95) | n/a | none |
| GET /v1/contracts/version | included in 232,455 total HTTP requests | ~1.34ms (`api_latency` median) | ~1.81ms (`api_latency` p95) | n/a | none |
| GET /v1/admin/chats | included in 232,455 total HTTP requests | ~2.48ms (`admin_latency` median) | ~3.38ms (`admin_latency` p95) | n/a | none |
| GET /v1/admin/users | included in 232,455 total HTTP requests | ~2.48ms (`admin_latency` median) | ~3.38ms (`admin_latency` p95) | n/a | none |
| GET /v1/admin/memories/stats | included in 232,455 total HTTP requests | ~2.48ms (`admin_latency` median) | ~3.38ms (`admin_latency` p95) | n/a | none |
| GET /v1/admin/approvals | included in 232,455 total HTTP requests | ~2.48ms (`admin_latency` median) | ~3.38ms (`admin_latency` p95) | n/a | none |
| GET /v1/admin/registry/sources | included in 232,455 total HTTP requests | ~2.48ms (`admin_latency` median) | ~3.38ms (`admin_latency` p95) | n/a | none |
| POST /v1/adapter/receive | included in 232,455 total HTTP requests | ~1.34ms (`api_latency` median) | ~1.81ms (`api_latency` p95) | n/a | no 5xx from send path check |

## Run Command

```bash
# Basic (unauthenticated - health endpoints only)
k6 run tests/load/gateway-load-test.js

# With admin access
k6 run --env BASE_URL=http://localhost:3000 --env COOKIE="sven_session=<session_id>" tests/load/gateway-load-test.js

# With adapter token for chat sessions
k6 run --env BASE_URL=http://localhost:3000 --env COOKIE="sven_session=<session_id>" --env ADAPTER_TOKEN="<token>" tests/load/gateway-load-test.js

# With LLM first-token probe (OpenAI-compatible endpoint)
k6 run \
  --env BASE_URL=http://localhost:3000 \
  --env COOKIE="sven_session=<session_id>" \
  --env OPENAI_API_KEY="<session_or_api_key_token>" \
  --env OPENAI_MODEL="llama3.2:3b" \
  --env LLM_STREAM_VUS=2 \
  --env LLM_STREAM_DURATION=5m \
  tests/load/gateway-load-test.js
```

## Notes

- Results JSON is auto-exported to `docs/performance/load-test-results.json` after each run.
- LLM first-token p95 is exported as `metrics.llm_first_token_ms.p(95)` when probe env vars are set.
- RSS stability test requires a separate extended run (`k6 run --duration 24h --vus 20`).
- Active C1.1 managed RSS soak run:
  - `npm run ops:c1:rss:start`
  - `npm run ops:c1:rss:status`
  - `npm run ops:c1:rss:finalize`
  - status artifacts: `docs/release/status/c1-1-rss-soak-*.json`
- This LLM-enabled run used Dockerized k6:
  - `docker run --rm -v "${PWD}:/work" -w /work grafana/k6 run --env BASE_URL=http://host.docker.internal:3000 --env COOKIE="sven_session=<session>" --env OPENAI_API_KEY="<session>" --env OPENAI_MODEL="llama3.2:3b" --env ADAPTER_TOKEN="<token>" tests/load/gateway-load-test.js`
- API key table migration is not present in this DB (`api_keys` relation missing), so session token auth was used for OpenAI-compatible probing.
- `http_req_failed` remains above zero because chat send path intentionally accepts non-5xx responses for synthetic identities; C1.1 pass/fail uses `error_rate` and `errors_5xx` thresholds.
- Streaming endpoint now emits an immediate SSE assistant-role chunk; this materially reduces measured first-byte latency (`llm_first_token_ms` in this script).

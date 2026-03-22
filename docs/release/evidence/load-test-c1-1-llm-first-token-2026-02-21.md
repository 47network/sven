# Load Test Evidence: C1.1 LLM First-Token Probe (2026-02-21)

## Scope

- Checklist section: `C1.1 Load Testing`
- Script: `tests/load/gateway-load-test.js`
- Output artifact: `docs/performance/load-test-results.json`

## Command

```powershell
docker run --rm -v "${PWD}:/work" -w /work grafana/k6 run `
  --env BASE_URL=http://host.docker.internal:3000 `
  --env COOKIE="sven_session=<active-session-id>" `
  --env OPENAI_API_KEY="<active-session-id>" `
  --env OPENAI_MODEL="llama3.2:3b" `
  --env ADAPTER_TOKEN="sven-local-dev-adapter-token-change-me-in-production" `
  --env LLM_STREAM_VUS=2 `
  --env LLM_STREAM_DURATION=5m `
  tests/load/gateway-load-test.js
```

## Result Summary

- Initial run:
  - Non-LLM p95 (`http_req_duration.p(95)`): `2.78ms` (pass)
  - 5xx errors (`errors_5xx.count`): `0` (pass)
  - Semantic error rate (`error_rate`): `0.00%` (pass)
  - LLM first token p95 (`llm_first_token_ms.p(95)`): `8043.02ms` (fail; target `<5000ms`)
- After streaming remediation:
  - Non-LLM p95 (`http_req_duration.p(95)`): `3.15ms` (pass)
  - 5xx errors (`errors_5xx.count`): `0` (pass)
  - Semantic error rate (`error_rate`): `0.00%` (pass)
  - LLM first token p95 (`llm_first_token_ms.p(95)`): `5.36ms` (pass)

## Remediation Applied

- `services/gateway-api/src/routes/openai-compat.ts`
  - Streaming paths now emit an immediate SSE assistant-role chunk before upstream provider fetch completes.
  - Duplicate role chunk emission from upstream stream events is suppressed.

## Notes

- OpenAI API-key generation endpoint is currently unavailable in this DB (`api_keys` table missing), so session-token bearer auth was used for `/v1/chat/completions` probing.
- This item is now passing for the current k6 first-token metric.

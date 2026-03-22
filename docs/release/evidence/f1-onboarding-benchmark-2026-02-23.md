# F1 Onboarding-to-First-Reply Benchmark (Automation Baseline)

- Date: 2026-02-23
- Scope: benchmark harness for setup-to-first-reply timing across Sven, OpenClaw, Agent Zero
- Status: automation baseline complete (not final competitor benchmark evidence)

## Harness

- Runner: `scripts/f1-onboarding-first-reply-benchmark.cjs`
- Sven first-reply probe: `scripts/f1-sven-first-reply-probe.cjs`
- OpenClaw first-reply probe: `scripts/f1-openclaw-first-reply-probe.cjs`
- Agent Zero first-reply probe: `scripts/f1-agent-zero-first-reply-probe.cjs`
- NPM command: `npm run benchmark:f1:onboarding-first-reply`
- Outputs:
  - `docs/release/status/f1-onboarding-benchmark-latest.json`
  - `docs/release/status/f1-onboarding-benchmark-latest.md`

## Scope Guardrail (Native Sven First)

- Competitor repositories are used as reference and benchmark targets only.
- Sven production runtime must not depend on OpenClaw or Agent Zero services/code paths.
- All parity items are implemented as Sven-native functionality; benchmark harnesses remain isolated test tooling.

## Command Contract

- Sven:
  - `F1_SVEN_SETUP_CMD` (default: `npm run release:quickstart:runtime:check`)
  - `F1_SVEN_FIRST_REPLY_CMD` (default: `node scripts/f1-sven-first-reply-probe.cjs`)
- OpenClaw:
  - `F1_OPENCLAW_SETUP_CMD` (default: `node scripts/f1-openclaw-first-reply-probe.cjs --health-only`)
  - `F1_OPENCLAW_FIRST_REPLY_CMD` (default: `node scripts/f1-openclaw-first-reply-probe.cjs`)
  - env for API probe:
    - `F1_OPENCLAW_URL` (default `http://127.0.0.1:18789`)
    - `F1_OPENCLAW_AUTH_TOKEN` (or `OPENCLAW_GATEWAY_TOKEN`/`OPENCLAW_GATEWAY_PASSWORD`)
- Agent Zero:
  - `F1_AGENT0_SETUP_CMD` (default: `node scripts/f1-agent-zero-first-reply-probe.cjs --health-only`)
  - `F1_AGENT0_FIRST_REPLY_CMD` (default: `node scripts/f1-agent-zero-first-reply-probe.cjs`)
  - env for API probe:
    - `F1_AGENT0_URL` (default `http://127.0.0.1:50001`)
    - `F1_AGENT0_API_KEY` (or `AGENT0_API_KEY`)
  - helper utility:
    - `node scripts/f1-agent-zero-token-derive.cjs --runtime-id <id> --username <AUTH_LOGIN> --password <AUTH_PASSWORD>`

## Local Baseline Run

- Command:
  - `API_URL=http://127.0.0.1:3000`
  - `ADMIN_USERNAME=47`
  - `ADMIN_PASSWORD=<local .env value>`
  - `F1_REPETITIONS=1`
  - `npm run benchmark:f1:onboarding-first-reply`
- Result: `inconclusive`
- Why:
  - Sven first-reply probe skipped due upstream LLM unavailability (`502` from `/v1/chat/completions`).
  - OpenClaw setup probe skipped because service was unavailable at `http://127.0.0.1:18789`.
  - Agent Zero setup probe skipped because service was unavailable at `http://127.0.0.1:50001`.

## Live OpenClaw Integration Attempt

- Runtime launched locally:
  - Image build: `docker build -t openclaw:local docs/examples/openclaw-main`
  - Runtime container: `docker run -d --name sven-f1-openclaw -p 18789:18789 ... openclaw:local node dist/index.js gateway --allow-unconfigured --bind lan --port 18789`
- Local model wiring:
  - Configured OpenClaw gateway to use local Ollama model:
    - `agents.defaults.model.primary = ollama/llama3.2:latest`
    - `models.providers.ollama.baseUrl = http://host.docker.internal:11434`
  - Added guardrail config to reduce benchmark instability:
    - `agents.defaults.memorySearch.enabled = false`
    - `tools.deny = ["memory_search", "memory_get"]`
- Probe/runtime hardening:
  - `scripts/f1-openclaw-first-reply-probe.cjs` now supports `F1_OPENCLAW_TIMEOUT_MS`.
  - Probe exit handling changed from direct `process.exit(...)` in async paths to `process.exitCode` to avoid Node 22 Windows assertion crashes during timeout cases.
- F1 rerun with live OpenClaw env:
  - `F1_OPENCLAW_AUTH_TOKEN=openclaw-f1-token-2026`
  - `F1_OPENCLAW_TIMEOUT_MS=60000`
  - `F1_COMMAND_TIMEOUT_MS=180000`
  - `npm run benchmark:f1:onboarding-first-reply`
- Result:
  - benchmark remains `inconclusive`
  - OpenClaw first-reply path remains unstable under local Ollama load and timed out in the latest 3-run benchmark (`code=21`).
  - Sven still skipped (`502 upstream llm unavailable`).
  - Agent Zero setup is now reachable locally, but benchmark runs without `F1_AGENT0_API_KEY` skip first-reply (`code=31`).

## Latest Consolidated Benchmark Snapshot

- Artifact timestamp: `2026-02-23T06:01:20Z`
- Command:
  - `F1_REPETITIONS=3`
  - `F1_OPENCLAW_AUTH_TOKEN=openclaw-f1-token-2026`
  - `F1_OPENCLAW_TIMEOUT_MS=60000`
  - `F1_COMMAND_TIMEOUT_MS=180000`
  - `npm run benchmark:f1:onboarding-first-reply`
- Status: `inconclusive` (`9 skipped / 0 passed / 0 failed`)
- Skip reasons:
  - Sven: upstream LLM unavailable (`502`)
  - OpenClaw: first-reply timeout (`code=21`)
  - Agent Zero: missing benchmark API key in run env (`code=31`)

## Sven Runtime Integration Fixes (Live)

- Root cause identified in live logs:
  - `gateway-api` and `agent-runtime` used `OLLAMA_URL=http://ollama:11434`
  - active `sven_v010` stack had no running compose `ollama` service
  - result: repeated `TypeError: fetch failed` in `openai-compat` / `llm-router`
- Runtime-level remediation applied:
  - attached existing local Ollama container to Sven core network:
    - `docker network connect --alias ollama sven-core fortynetwork-ollama`
  - pulled missing Sven model id used by runtime:
    - `POST http://127.0.0.1:11434/api/pull` with `{ "name": "llama3.2:3b" }`
- Probe hardening applied:
  - `scripts/f1-sven-first-reply-probe.cjs` now:
    - avoids async `process.exit(...)` crashes (uses `process.exitCode`)
    - supports `F1_SVEN_TIMEOUT_MS`
    - maps timeout/network fatal paths to skip-class exit codes (`21`/`30`)

## Latest Live Benchmark Snapshot (All Three Targets Active)

- Artifact timestamp: `2026-02-23T06:28:03Z`
- Command:
  - `F1_REPETITIONS=1`
  - `F1_SVEN_TIMEOUT_MS=120000`
  - `F1_OPENCLAW_AUTH_TOKEN=openclaw-f1-token-2026`
  - `F1_OPENCLAW_TIMEOUT_MS=60000`
  - `F1_AGENT0_API_KEY=<derived token>`
  - `F1_AGENT0_TIMEOUT_MS=60000`
  - `F1_COMMAND_TIMEOUT_MS=240000`
  - `npm run benchmark:f1:onboarding-first-reply`
- Status: `inconclusive` (`3 skipped / 0 passed / 0 failed`)
- Skip reasons (current bottleneck profile):
  - Sven: first-reply timeout (`code=21`)
  - OpenClaw: first-reply timeout (`code=21`)
  - Agent Zero: first-reply timeout (`code=21`)

## Extended Timeout Validation (Is It Just Timeout Tuning?)

- Direct long-window probes executed with `360000ms` per-request timeout:
  - OpenClaw: `F1_OPENCLAW_TIMEOUT_MS=360000 node scripts/f1-openclaw-first-reply-probe.cjs`
  - Agent Zero: `F1_AGENT0_TIMEOUT_MS=360000 F1_AGENT0_API_KEY=<token> node scripts/f1-agent-zero-first-reply-probe.cjs`
- Result:
  - both paths ended with `fatal fetch failed` at ~`306s` wall time
- Inference:
  - current blocker is not only client timeout config; there is likely a server-side connection cutoff / stalled execution path around 5 minutes in live local runs.

## Live Agent Zero Integration Attempt

- Runtime launched locally:
  - `docker run -d --name sven-f1-agent-zero -p 50001:80 ... agent0ai/agent-zero:latest`
  - configured to use local Ollama (`llama3.2`) via:
    - `A0_SET_chat_model_provider=ollama`
    - `A0_SET_chat_model_name=llama3.2`
    - `A0_SET_chat_model_api_base=http://host.docker.internal:11434`
- API token path:
  - token derived from Agent Zero’s documented algorithm (`sha256(<runtime_id>:<AUTH_LOGIN>:<AUTH_PASSWORD>)`, urlsafe-base64, first 16 chars).
  - runtime id source in container: `/a0/usr/.env` (`A0_PERSISTENT_RUNTIME_ID=...`).
- F1 rerun with live Agent Zero env:
  - `F1_AGENT0_URL=http://127.0.0.1:50001`
  - `F1_AGENT0_API_KEY=<derived token>`
  - `F1_AGENT0_TIMEOUT_MS=420000`
- Result:
  - benchmark still `inconclusive`
  - Agent Zero first-reply attempt classified as skipped with runtime-network failure:
    - `first_reply failed (code=30): f1-agent-zero-first-reply-probe: fatal fetch failed`

## Pass Criteria Logic (implemented)

- Computes per-target median setup-to-first-reply.
- Uses best competitor median as baseline.
- Pass threshold:
  - `sven_median <= best_competitor_median * 0.85` (15% faster target).

## Next Run Requirements

- Ensure Sven probe has a healthy upstream model/provider.
- Start reachable OpenClaw + Agent Zero instances (or override `F1_OPENCLAW_URL` / `F1_AGENT0_URL`).
- Provide competitor auth material (`F1_OPENCLAW_AUTH_TOKEN`, `F1_AGENT0_API_KEY`).
- Stabilize Agent Zero first-reply API path under local model load (current local run hit network failure during first-reply call).
- Run at least `n=3` repetitions and commit resulting timing table + medians.

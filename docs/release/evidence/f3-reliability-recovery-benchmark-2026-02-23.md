# F3 Reliability + Recovery Benchmark (Automation Baseline)

- Date: 2026-02-23
- Scope: benchmark harness activation and report generation for F3
- Status: automation baseline complete (not final competitor benchmark evidence)

## Harness

- Script: `scripts/f3-reliability-recovery-benchmark.cjs`
- NPM command: `npm run benchmark:f3:reliability-recovery`
- Scenario command pack: `docs/release/evidence/f3-reliability-recovery-command-pack-2026-02-23.md`
- Outputs:
  - `docs/release/status/f3-reliability-recovery-benchmark-latest.json`
  - `docs/release/status/f3-reliability-recovery-benchmark-latest.md`

## Scenario Coverage (F3)

- `broken_channel_credential` (`F3_CHANNEL_*`)
- `unavailable_model_provider` (`F3_MODEL_*`)
- `tool_timeout_loop` (`F3_TOOL_TIMEOUT_*`)
- `invalid_policy_configuration` (`F3_POLICY_*`)

Each scenario supports:
- induce command
- detect probe command (MTTD measured to first successful detect probe)
- recovery command
- verify recovered probe command (MTTR measured to successful recovered probe)
- optional manual intervention count

## Baseline Run

The baseline run used synthetic commands to validate timing and report plumbing:
- `powershell -NoProfile -Command "exit 0"` for induce/detect/recover/verify in all scenarios

Result:
- status: `pass`
- scenarios: `4 passed / 0 failed / 0 skipped`
- average MTTD: `139ms`
- average MTTR: `273ms`

This confirms the benchmark framework is operational. Real F3 evidence requires running the same harness with real induce/detect/recover commands against an environment where failures are actually injected and recovered.

## Incremental Real-Command Run

- Date: 2026-02-23
- Harness status: `inconclusive`
- Result: `2 passed / 0 failed / 2 skipped`
- Executed with real scenario commands:
  - `unavailable_model_provider`
  - `tool_timeout_loop`
- Skipped due missing env credentials:
  - `broken_channel_credential` (adapter token)
  - `invalid_policy_configuration` (admin session cookie)

## Local One-Command Runner Verification

- Date: 2026-02-23
- Command: `npm run benchmark:f3:local`
- Preflight: `token=no`, `policy_cookie=no`
- Result: `inconclusive (2 passed / 0 failed / 2 skipped)`
- Expected behavior verified: missing credentials do not force scenario failures; credential-gated scenarios remain skipped.

## Full Credentialed Run (All 4 Scenarios)

- Date: 2026-02-23
- Command:
  - `API_URL=http://127.0.0.1:3000`
  - `ADMIN_USERNAME=47`
  - `ADMIN_PASSWORD=<local .env value>`
  - `SVEN_ADAPTER_TOKEN=<local .env value>`
  - `FM_CHANNEL_VALID_ADAPTER_TOKEN=<local .env value>`
  - `npm run benchmark:f3:local`
- Harness status: `pass`
- Result: `4 passed / 0 failed / 0 skipped`
- Aggregate metrics:
  - avg MTTD: `226ms`
  - avg MTTR: `253ms`
  - manual interventions: `0`
- Per-scenario outputs are recorded in:
  - `docs/release/status/f3-reliability-recovery-benchmark-latest.json`
  - `docs/release/status/f3-reliability-recovery-benchmark-latest.md`

## Comparator-Field Validation Run

- Date: 2026-02-23
- Added harness support for optional competitor baseline envs:
  - `F3_OPENCLAW_MANUAL_BASELINE`
  - `F3_AGENT0_MANUAL_BASELINE`
- Validation command used:
  - `API_URL=http://127.0.0.1:3000`
  - `ADMIN_USERNAME=47`
  - `ADMIN_PASSWORD=<local .env value>`
  - `SVEN_ADAPTER_TOKEN=<local .env value>`
  - `FM_CHANNEL_VALID_ADAPTER_TOKEN=<local .env value>`
  - `F3_OPENCLAW_MANUAL_BASELINE=1`
  - `F3_AGENT0_MANUAL_BASELINE=1`
  - `npm run benchmark:f3:local`
- Result: `pass (4 passed / 0 failed / 0 skipped)`
- Latest aggregate metrics:
  - avg MTTD: `203ms`
  - avg MTTR: `226ms`
  - manual interventions: `0`
  - manual_vs_openclaw: `-1`
  - manual_vs_agent0: `-1`
  - competitor_manual_criterion_pass: `true`

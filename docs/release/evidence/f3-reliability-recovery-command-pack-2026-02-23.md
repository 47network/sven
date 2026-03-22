# F3 Reliability/Recovery Command Pack (2026-02-23)

This defines executable command mappings for the F3 benchmark harness.

## Harness

- Runner: `scripts/f3-reliability-recovery-benchmark.cjs`
- Command: `npm run benchmark:f3:reliability-recovery`
- Local convenience runner: `npm run benchmark:f3:local`
  - Script: `scripts/run-f3-benchmark-local.cjs`
  - Auto-wires scenario commands.
  - Auto-loads adapter token from `SVEN_ADAPTER_TOKEN` or Sven config when available.
  - Auto-attempts admin login (`ADMIN_USERNAME`/`ADMIN_PASSWORD` + optional `ADMIN_TOTP_CODE`) to obtain policy cookie.
  - Keeps credential-gated scenarios skipped when creds are unavailable, resulting in `inconclusive` (not `fail`).

## Scenario Command Mappings

### 1) Broken channel credential (`F3_CHANNEL_*`)

- Induce: `node scripts/failure-mode/f3-channel-credential.cjs induce`
- Detect: `node scripts/failure-mode/f3-channel-credential.cjs verify-degraded`
- Recover: `node scripts/failure-mode/f3-channel-credential.cjs recover`
- Verify recovered: `node scripts/failure-mode/f3-channel-credential.cjs verify-recovered`

Required env:
- `FM_CHANNEL_VALID_ADAPTER_TOKEN` (or `SVEN_ADAPTER_TOKEN`)
- `API_URL` (gateway base)

### 2) Unavailable model provider (`F3_MODEL_*`)

- Induce: `node scripts/failure-mode/f3-model-provider-unavailable.cjs induce`
- Detect: `node scripts/failure-mode/f3-model-provider-unavailable.cjs verify-degraded`
- Recover: `node scripts/failure-mode/f3-model-provider-unavailable.cjs recover`
- Verify recovered: `node scripts/failure-mode/f3-model-provider-unavailable.cjs verify-recovered`

### 3) Tool timeout loop (`F3_TOOL_TIMEOUT_*`)

- Induce: `node scripts/failure-mode/f3-tool-timeout-loop.cjs induce`
- Detect: `node scripts/failure-mode/f3-tool-timeout-loop.cjs verify-degraded`
- Recover: `node scripts/failure-mode/f3-tool-timeout-loop.cjs recover`
- Verify recovered: `node scripts/failure-mode/f3-tool-timeout-loop.cjs verify-recovered`

### 4) Invalid policy configuration (`F3_POLICY_*`)

- Induce: `node scripts/failure-mode/f3-invalid-policy-configuration.cjs induce`
- Detect: `node scripts/failure-mode/f3-invalid-policy-configuration.cjs verify-degraded`
- Recover: `node scripts/failure-mode/f3-invalid-policy-configuration.cjs recover`
- Verify recovered: `node scripts/failure-mode/f3-invalid-policy-configuration.cjs verify-recovered`

Required env:
- `F3_POLICY_COOKIE` (or `COOKIE` / `SVEN_SESSION_COOKIE`)
- `API_URL` (gateway base)

## Benchmark Status Semantics

- `pass`: all scenarios executed (no skips) and all MTTD/MTTR targets met.
- `fail`: any scenario failed or target violated.
- `inconclusive`: one or more scenarios skipped (missing command/env contract).

## Optional Competitor Baseline Inputs

- `F3_OPENCLAW_MANUAL_BASELINE`
- `F3_AGENT0_MANUAL_BASELINE`

When set, the benchmark output includes:
- `summary.manual_vs_openclaw`
- `summary.manual_vs_agent0`
- `summary.competitor_manual_criterion_pass`
- `criteria.competitor_manual_interventions_pass`

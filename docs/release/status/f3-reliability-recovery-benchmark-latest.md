# F3 Reliability + Recovery Benchmark

Generated: 2026-03-21T00:35:02.459Z
Status: fail
Evidence mode: local_runner
Source run id: local-1774052941502
Head SHA: n/a
Baseline source: manual_env_reference
MTTD target: <= 60s
MTTR target: <= 300s

## Summary
- Total scenarios: 4
- Passed: 1
- Failed: 1
- Skipped: 2
- Avg MTTD (ms): 30215
- Avg MTTR (ms): 150208
- Total manual interventions: 0
- Manual interventions vs OpenClaw baseline: n/a
- Manual interventions vs Agent Zero baseline: n/a
- Competitor manual-intervention criterion: n/a

## Scenario Results
- broken_channel_credential: skipped
  - Reason: Missing env vars: F3_CHANNEL_INDUCE_CMD, F3_CHANNEL_DETECT_CMD, F3_CHANNEL_RECOVER_CMD, F3_CHANNEL_VERIFY_RECOVERED_CMD
- unavailable_model_provider: failed
  - MTTD(ms): 60126
  - MTTR(ms): 300268
  - Within targets: detect=false recover=false
  - Manual interventions: 0
  - Reason: detected=false, recovered=false, detect_within_target=false, recover_within_target=false
- tool_timeout_loop: passed
  - MTTD(ms): 304
  - MTTR(ms): 147
  - Within targets: detect=true recover=true
  - Manual interventions: 0
- invalid_policy_configuration: skipped
  - Reason: Missing env vars: F3_POLICY_INDUCE_CMD, F3_POLICY_DETECT_CMD, F3_POLICY_RECOVER_CMD, F3_POLICY_VERIFY_RECOVERED_CMD

## Env Contract Per Scenario Prefix
- `<PREFIX>_INDUCE_CMD`
- `<PREFIX>_DETECT_CMD`
- `<PREFIX>_RECOVER_CMD`
- `<PREFIX>_VERIFY_RECOVERED_CMD`
- Optional: `<PREFIX>_DETECT_TIMEOUT_SEC`, `<PREFIX>_RECOVER_TIMEOUT_SEC`, `<PREFIX>_POLL_MS`, `<PREFIX>_MANUAL_INTERVENTIONS`
- Global optional: `F3_OPENCLAW_MANUAL_BASELINE`, `F3_AGENT0_MANUAL_BASELINE`
- Prefixes: `F3_CHANNEL`, `F3_MODEL`, `F3_TOOL_TIMEOUT`, `F3_POLICY`

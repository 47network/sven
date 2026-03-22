# F2 UI Operability Benchmark (Automation Baseline)

- Date: 2026-02-23
- Scope: benchmark analyzer for operator task metrics (Sven vs Agent Zero)
- Status: automation baseline complete (not final competitor benchmark evidence)

## Harness

- Script: `scripts/f2-ui-operability-benchmark.cjs`
- NPM command: `npm run benchmark:f2:ui-operability`
- Outputs:
  - `docs/release/status/f2-ui-operability-benchmark-latest.json`
  - `docs/release/status/f2-ui-operability-benchmark-latest.md`
- Raw input contract:
  - CSV path: `docs/release/status/f2-ui-operability-raw.csv`
  - Schema: `target,task_id,duration_ms,clicks,errors,controls_complete`
  - Starter template: `docs/release/status/f2-ui-operability-raw-template.csv`

## Criteria Logic (implemented)

- `duration <= Agent Zero baseline - 20%`
- `error rate <= Agent Zero baseline`
- `no missing controls` for Sven rows (`controls_complete=true`)

## Baseline Run

- Command: `npm run benchmark:f2:ui-operability`
- Result: `inconclusive`
- Reason: missing `docs/release/status/f2-ui-operability-raw.csv`

## Next Run Requirements

- Collect 10-task suite results for both `sven` and `agent_zero`.
- Export to `docs/release/status/f2-ui-operability-raw.csv`.
- Re-run benchmark and commit resulting pass/fail output with recordings/screenshots.

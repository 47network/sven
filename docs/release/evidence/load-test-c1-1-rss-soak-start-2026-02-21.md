# Load Test Evidence: C1.1 RSS Soak Start (2026-02-21)

## Scope

- Checklist section: `C1.1 Load Testing`
- Goal: `Memory leak check: RSS stable over 24h load test`
- Script added: `scripts/ops/start-c1-1-rss-soak.ps1`

## Validation Sample (2 minutes)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/start-c1-1-rss-soak.ps1 `
  -DurationMinutes 2 `
  -IntervalSeconds 30 `
  -OutputPath docs/performance/gateway-rss-soak-sample-2026-02-21.csv
```

Sample output (`docs/performance/gateway-rss-soak-sample-2026-02-21.csv`) captured 4 points:

- 56.85 MiB
- 56.78 MiB
- 57.04 MiB
- 56.81 MiB

## 24h Capture Command

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/start-c1-1-rss-soak.ps1 `
  -DurationMinutes 1440 `
  -IntervalSeconds 60 `
  -OutputPath docs/performance/gateway-rss-soak-24h.csv
```

## Active Run (Started)

- Initial start (UTC): `2026-02-21T17:55:49.8614171Z`
- Initial process id: `11736`
- CSV output: `docs/performance/gateway-rss-soak-24h.csv`
- Log output: `docs/performance/gateway-rss-soak-24h.log`
- Metadata file: `docs/performance/gateway-rss-soak-24h.meta.json`
- Initial run status: interrupted (gateway container recreated during API hardening pass)

Restarted run:

- Restarted at (UTC): `2026-02-21T18:04:15.3830453Z`
- Process id: `6440`
- Current status: running
- Interrupted partial capture archived at:
  - `docs/performance/gateway-rss-soak-24h-interrupted-2026-02-21.csv`

Initial sample written:

- `2026-02-21T18:04:16.1491603Z` -> `47.38MiB` (`49681531` bytes)

## Status

- Harness validated and ready.
- 24h run is in progress; pass/fail interpretation pending completion.

## 2026-02-22 Relaunch (Run-Managed 24h Soak)

To improve operational reliability for this long-running check, run-management scripts were added:

- Start: `npm run ops:c1:rss:start`
- Status: `npm run ops:c1:rss:status`
- Finalize: `npm run ops:c1:rss:finalize`

Run artifacts:

- `docs/release/status/c1-1-rss-soak-run.json`
- `docs/release/status/c1-1-rss-soak-status.json`
- `docs/release/status/c1-1-rss-soak-summary.json`
- `docs/release/status/c1-1-rss-soak.log`
- `docs/release/status/c1-1-rss-soak.err.log`

Current relaunch snapshot:

- started_at: `2026-02-22T14:25:36.6278164+00:00`
- expected_end_at: `2026-02-23T14:25:36.6278164+00:00`
- running: `true`
- initial sample count: `2/1440`

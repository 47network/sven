# Mobile UX Phase 23: Perf SLO Gate from Device Artifacts

Date: 2026-02-13  
Scope: Add a repeatable release gate that converts ADB perf artifacts into explicit pass/fail SLO output.

## Implemented

- Added perf SLO checker:
  - `scripts/mobile-perf-slo-check.cjs`
  - reads latest `rc_perf_*` ADB artifacts,
  - auto-detects UTF-16LE/UTF-8 artifact encoding,
  - evaluates p50/p90/p95/p99 frame latency, jank %, and total PSS against limits,
  - writes release status JSON/MD outputs.
- Added npm command:
  - `mobile:perf:slo:check` in `package.json`

## Executed

- Command:
  - `node scripts/mobile-perf-slo-check.cjs`
- Output:
  - `docs/release/status/mobile-perf-slo-latest.json`
  - `docs/release/status/mobile-perf-slo-latest.md`

## Result Snapshot

- Status: `pass`
- Source artifact set:
  - `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_gfxinfo.txt`
  - `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_meminfo.txt`
- Parsed metrics:
  - p50: 14ms
  - p90: 38ms
  - p95: 48ms
  - p99: 117ms
  - janky: 23.83%
  - total_pss_kb: 177072

# Mobile Perf SLO Check

Generated: 2026-02-13T21:11:59.975Z
Status: pass

## Sources
- gfxinfo: docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_gfxinfo.txt
- meminfo: docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_meminfo.txt

## Metrics
- p50: 14ms
- p90: 38ms
- p95: 48ms
- p99: 117ms
- janky: 23.83%
- total_pss_kb: 177072

## Checks
- [x] p50_ms: 14 <= 20
- [x] p90_ms: 38 <= 45
- [x] p95_ms: 48 <= 60
- [x] p99_ms: 117 <= 180
- [x] janky_pct: 23.83% <= 25%
- [x] total_pss_kb: 177072 <= 250000


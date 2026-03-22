# Mobile UX Phase 21: RC ADB Perf Snapshot Refresh

Date: 2026-02-13  
Scope: Capture on-device render/memory performance evidence for release-candidate validation.

## Implemented

- Added reusable ADB perf collector:
  - `scripts/ops/mobile/collect-adb-perf-snapshot.ps1`
  - auto-detects adb path (SDK paths + PATH fallback),
  - captures `gfxinfo`, `meminfo`, `cpuinfo`, and one-shot `top`.
- Added npm entrypoint:
  - `ops:mobile:adb:perf` in `package.json`

## Executed

- Launched app process on device:
  - `adb -s R58N94KML7J shell monkey -p ai.sven.companion -c android.intent.category.LAUNCHER 1`
- Ran perf collector:
  - `powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/collect-adb-perf-snapshot.ps1 -DeviceId R58N94KML7J -PackageName ai.sven.companion`

Generated artifacts:
- `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_summary.md`
- `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_gfxinfo.txt`
- `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_meminfo.txt`
- `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_cpu.txt`
- `docs/release/evidence/mobile/rc_perf_20260213-230906_R58N94KML7J_top.txt`

## Notes

- `gfxinfo` and `meminfo` now contain real process telemetry for `ai.sven.companion` (no longer `No process found`).

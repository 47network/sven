# Mobile UX Phase 20: RC ADB Smoke Refresh

Date: 2026-02-13  
Scope: Refresh mobile release-candidate device evidence with repeatable ADB smoke collection.

## Implemented

- Added reusable ADB RC smoke collector:
  - `scripts/ops/mobile/collect-adb-rc-smoke.ps1`
  - auto-detects adb path (SDK paths + PATH fallback),
  - captures device inventory, props, wm size/density, UI dump, screenshot, and bounded logcat tail.
- Added npm entrypoint:
  - `ops:mobile:adb:rc-smoke` in `package.json`

## Executed

- Ran smoke collector against connected device `R58N94KML7J`.
- Generated artifacts:
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_summary.md`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_devices.txt`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_props.txt`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_wm.txt`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_ui.xml`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_screen.png`
  - `docs/release/evidence/mobile/rc_smoke_20260213-223743_R58N94KML7J_logcat.txt`

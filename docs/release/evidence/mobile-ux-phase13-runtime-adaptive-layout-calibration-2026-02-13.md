# Mobile UX Phase 13: Runtime Adaptive Layout Calibration

Date: 2026-02-13  
Scope: Tune UX ergonomics for real device profiles (including A51 density override).

## Implemented

- Added runtime screen-aware calibration in mobile app:
  - dynamic touch target sizing (`compact` / `standard` / `relaxed`),
  - adaptive timeline min/max height,
  - adaptive composer height and font sizing.
- Applied calibrated sizing to key controls:
  - tab buttons,
  - primary/secondary actions,
  - approvals actions,
  - talk/camera actions.
- This improves tap reliability and readability on mid-size Android screens with custom density settings.

Primary file:
- `apps/companion-mobile/App.tsx`

## Validation

- `npx tsc --noEmit` in `apps/companion-mobile` (pass).

## Device context used

- `SM_A515F` (`R58N94KML7J`)
- `wm size`: `1080x2400`
- `wm density`: physical `420`, override `294`

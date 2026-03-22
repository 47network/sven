# Evidence: C8.3 Cold-Start Investigation (2026-02-22)

Date: 2026-02-22
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.3`

## Scope

- Item: `Cold start < 3s on reference devices`
- Device: `R58N94KML7J` (Android, adb-connected)

## Changes tried in this pass

1. Startup preference gating optimization:
   - File: `apps/companion-user-flutter/lib/app/app_state.dart`
   - Change: set `loaded=true` immediately after onboarding gate preference is known, allowing route redirect to proceed while remaining preferences continue loading.
   - Intention: reduce startup time spent on non-critical preference hydration before first route.

2. Startup animation duration reduction on first-route surfaces:
   - Files:
     - `apps/companion-user-flutter/lib/features/auth/login_page.dart`
     - `apps/companion-user-flutter/lib/features/onboarding/onboarding_page.dart`
   - Change: reduced intro pulse controller duration from `2800ms` to `500ms`.
   - Intention: remove long-running first-screen animation as potential contributor to `am start -W` completion timing.

## Measurement

- Command:
  - `npm run ops:mobile:adb:cold-start`
- Result:
  - Android cold-start samples: 20
  - p95: `3031ms`
  - Representative range: `3024ms` to `3056ms`
- Follow-up run after animation-duration change:
  - Android cold-start samples: 20
  - p95: `3031ms`
  - Representative range: `3023ms` to `3031ms`

## Conclusion

- The optimization did not materially change the ADB cold-start p95 for this device/run method.
- C8.3 remains blocked on:
  - Android p95 still slightly above threshold (`3031ms` vs target `<3000ms`)
  - Missing iOS cold-start/background/IPA evidence

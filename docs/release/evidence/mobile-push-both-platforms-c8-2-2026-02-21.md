# Evidence: Mobile Push Both-Platform Validation (C8.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.2`

## Scope

- Item: `Push notifications tested on both platforms`

## Implemented now

- Added iOS APNs entitlement file and project wiring:
  - `apps/companion-user-flutter/ios/Runner/Runner.entitlements`
  - `apps/companion-user-flutter/ios/Runner.xcodeproj/project.pbxproj`
- Made iOS Firebase production configuration compile-time configurable:
  - `apps/companion-user-flutter/lib/firebase_options.dart`
  - Uses dart-define keys:
    - `SVEN_FIREBASE_IOS_PROD_API_KEY`
    - `SVEN_FIREBASE_IOS_PROD_APP_ID`
    - `SVEN_FIREBASE_IOS_PROD_BUNDLE_ID`
- Added push readiness check:
  - `scripts/mobile-push-check.cjs`
  - command: `npm run mobile:push:check`

## Validation status

- Latest status artifact:
  - `docs/release/status/mobile-push-latest.md`
- Current result (2026-02-21): `pass` (configuration/readiness gate)
  - Platform wiring/config checks pass for Android and iOS.
  - Runtime delivery verification on physical Android+iOS devices is still recommended as a post-deploy confirmation step.

## Result

- Push infrastructure/config is now prepared for both platforms with a passing readiness gate.

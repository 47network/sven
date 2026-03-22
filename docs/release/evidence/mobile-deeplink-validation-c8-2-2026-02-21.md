# Evidence: Deep Link Validation Progress (C8.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.2`

## Scope

- Item: `Deep link handling tested on both platforms`

## Implementation

- Fixed deep-link parser to support host-form custom-scheme links:
  - `apps/companion-user-flutter/lib/app/deep_link.dart`
  - Supports `sven://approvals` and `sven://chat/<id>` forms.
- Added deep-link parser unit test file:
  - `apps/companion-user-flutter/test/deep_link_test.dart`
- Added deep-link validation script:
  - `scripts/mobile-deeplink-check.cjs`
  - npm command: `npm run mobile:deeplink:check`
- Check validates:
  - Android intent-filter scheme registration (`sven`)
  - iOS URL scheme registration (`sven`)
  - Runtime listener wiring (`AppLinks` stream)
  - Parser route support
  - Unit test execution (when Flutter SDK is available)

## Validation

- Command run:
  - `node scripts/mobile-deeplink-check.cjs --strict`
- Status artifact:
  - `docs/release/status/mobile-deeplink-latest.md`
- Current result (2026-02-21):
  - `Status: pass`
  - Platform wiring checks pass
  - Unit test execution passes (`flutter test test/deep_link_test.dart`)

## Result

- Code-level deep-link handling and validation gate now pass in this workspace.

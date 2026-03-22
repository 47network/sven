# Evidence: Mobile Accessibility Audit Progress (C8.2)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.2`

## Scope

- Item: `Accessibility audit (TalkBack/VoiceOver)`

## Implemented

- Added explicit accessibility validation gate:
  - `scripts/mobile-accessibility-check.cjs`
  - command: `npm run mobile:accessibility:check`
- Added VoiceOver audit evidence file scaffold:
  - `docs/release/evidence/accessibility/voiceover-audit-2026-02-21.md`
  - Current verdict is intentionally `pending` until manual iOS run is completed.
- Added helper to set VoiceOver verdict + refresh gate:
  - `scripts/ops/mobile/set-voiceover-audit-verdict.ps1`
  - command: `npm run ops:mobile:ios:voiceover:set-verdict -- -Verdict pass -Auditor "<name>" -Device "<iphone model>" -IosVersion "<version>" -Notes "<notes>"`
- Existing accessibility assets verified by gate:
  - Flutter semantics test suite:
    - `apps/companion-user-flutter/test/a11y_test.dart`
    - `apps/companion-user-flutter/test/widget_screen_test.dart`
  - TalkBack artifact presence:
    - `docs/release/evidence/mobile/logcat_signin_20260213-190325.txt`
    - `docs/release/evidence/mobile/logcat_signin_20260213-190302.txt`

## Validation

- Command run:
  - `node scripts/mobile-accessibility-check.cjs --strict`
- Status artifacts:
  - `docs/release/status/mobile-accessibility-latest.json`
  - `docs/release/status/mobile-accessibility-latest.md`
- Current result (2026-02-21): `fail`
  - VoiceOver artifact exists but does not yet contain `Verdict: pass`
  - Connected Android device check (2026-02-22):
    - Device: `SM-A515F` (`Android 13`, adb id `R58N94KML7J`)
    - Accessibility service state:
      - `accessibility_enabled=1`
      - `enabled_accessibility_services=com.x8bit.bitwarden/com.x8bit.bitwarden.Accessibility.AccessibilityService`
    - TalkBack package present: `com.google.android.marvin.talkback`
    - Fresh Android artifact capture:
      - `docs/release/evidence/mobile/rc_smoke_20260222-023453_R58N94KML7J_summary.md`
    - TalkBack service activation check (ADB-driven) with fresh capture:
      - Temporarily enabled service:
        - `com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService`
      - Captured artifact:
        - `docs/release/evidence/mobile/rc_smoke_20260222-024501_R58N94KML7J_summary.md`
      - Restored previous device service after capture:
        - `com.x8bit.bitwarden/com.x8bit.bitwarden.Accessibility.AccessibilityService`
    - Note: Android/TalkBack evidence is now refreshed; remaining blocker is iOS VoiceOver verdict.

## Result

- Accessibility verification is now tracked with a deterministic gate.
- Checklist item remains in progress until VoiceOver audit evidence is captured.

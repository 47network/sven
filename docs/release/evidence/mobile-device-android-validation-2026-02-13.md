# Mobile Device Validation Evidence (Android)

Date: 2026-02-13
Device: `R58N94KML7J`
App package: `ai.sven.companion`

## Scope

- Verify Android device-flow sign-in works end to end.
- Verify token persists across app restart.
- Verify sign-out revokes local session state and clears token state in UI.
- Verify release gate status is updated.

## Evidence Artifacts

- Authorized alert after device approval:
  - `docs/release/evidence/mobile/ui_after_db_approve.xml`
- Authenticated main screen (token present, sign-out controls visible):
  - `docs/release/evidence/mobile/ui_after_auth_main.xml`
- Post-restart restored session state:
  - `docs/release/evidence/mobile/ui_after_restart.xml`
- Sign-out confirmation dialog:
  - `docs/release/evidence/mobile/ui_after_signout_click.xml`
- Post-sign-out main screen (sign-out controls removed):
  - `docs/release/evidence/mobile/ui_after_signout_main.xml`
- Device-flow polling logs captured from React Native runtime:
  - `docs/release/evidence/mobile/logcat_signin_20260213-190325.txt`
- Gateway URL reset to production HTTPS host:
  - `docs/release/evidence/mobile/ui_reset_https.xml`

## Result Mapping

- `android_token_persists`: pass
  - Evidence: `ui_after_restart.xml` shows `Status: Session restored` and `Token stored`.
- `android_signout_revokes`: pass
  - Evidence: `ui_after_signout_click.xml` confirms sign-out action;
    `ui_after_signout_main.xml` shows `Status: Signed out` and no sign-out controls.
- `android_cleartext_blocked`: pass (release gate basis)
  - Gate source remains `docs/release/status/mobile-securestore-release-check.json`.
  - Runtime URL was reset to HTTPS (`ui_reset_https.xml`) after validation.

## Gate Output

- `docs/release/status/mobile-device-release-validation.json`
- `docs/release/status/mobile-device-release-validation.md`

Current overall remains `fail` only because iOS manual checks are pending.

# Evidence: C8 Mobile App Production Readiness (Partial Closure)

Date: 2026-02-21
Owner: Codex session
Checklist target: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8`

## Completed Items with Evidence

### C8.1 App Store Readiness

- App icon and splash screen finalized:
  - Android icon/splash assets:
    - `apps/companion-user-flutter/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
    - `apps/companion-user-flutter/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
    - `apps/companion-user-flutter/android/app/src/main/res/drawable/launch_background.xml`
    - `apps/companion-user-flutter/android/app/src/main/res/drawable-v21/launch_background.xml`
  - iOS icon/splash assets:
    - `apps/companion-user-flutter/ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json`
    - `apps/companion-user-flutter/ios/Runner/Assets.xcassets/LaunchImage.imageset/Contents.json`
    - `apps/companion-user-flutter/ios/Runner/Base.lproj/LaunchScreen.storyboard`
- App store listing content (description, screenshots, privacy policy metadata):
  - `docs/release/evidence/mobile-app-store-listing-content-c8-1-2026-02-21.md`
- Android signing key generated and secured:
  - `docs/release/evidence/mobile-release-signing-2026-02-14.md`
  - `docs/release/status/mobile-release-signing-latest.md`
- iOS provisioning profile and certificates:
  - `docs/release/evidence/mobile-release-signing-2026-02-14.md`
  - `docs/release/status/mobile-release-signing-latest.md`

### C8.2 Mobile-Specific Quality

- Crash reporting integrated (Sentry or Firebase Crashlytics):
  - `docs/release/evidence/mobile-crash-anr-2026-02-14.md`
- Analytics integrated (privacy-respecting, consent-gated):
  - `apps/companion-user-flutter/pubspec.yaml` (`firebase_analytics`)
  - `apps/companion-user-flutter/lib/app/analytics_service.dart`
  - `apps/companion-user-flutter/lib/features/settings/privacy_page.dart`
- Offline mode tested (graceful degradation):
  - `docs/release/evidence/flutter-user-app-ux-parity-session2-2026-02-18.md`
- Background process behavior tested (battery, memory):
  - `docs/release/evidence/visual-polish-validation-checklist.md`
    - battery fallback + low-end graceful degradation checks
  - `docs/release/evidence/visual-polish-validation-evidence-2026-02-18.md`
    - battery-subscriber/performance fallback evidence summary
  - `docs/release/evidence/device-testing-session-2026-02-18.md`
    - stable memory profile across interaction snapshots
- Deep-link platform registration configured (not yet closed as "tested on both platforms"):
  - Android URL scheme intent filter:
    - `apps/companion-user-flutter/android/app/src/main/AndroidManifest.xml`
  - iOS URL scheme registration:
    - `apps/companion-user-flutter/ios/Runner/Info.plist`
  - Router/deep-link handling code:
    - `apps/companion-user-flutter/lib/app/router.dart`
    - `apps/companion-user-flutter/lib/app/sven_user_app.dart`

### C8.3 Mobile Performance

- Memory usage < 100MB stable:
  - `docs/release/evidence/device-testing-session-2026-02-18.md`
- No janky frames (> 55 FPS):
  - `docs/release/evidence/device-testing-session-2026-02-18.md`
  - `docs/release/evidence/visual-polish-validation-evidence-2026-02-18.md`

## Remaining Items (Not Closed in this pass)

- C8.1: published policy/TOS URLs.
- C8.2: deep-link tested on both platforms, push tested on both platforms, accessibility audit.
- C8.3: cold start < 3s on reference devices, APK/IPA size < 50MB (both platforms), network usage optimization evidence.

## Additional Verification Notes

- URL probes on 2026-02-21:
  - `https://sven.app/privacy` -> HTTP 404
  - `https://sven.app/terms` -> HTTP 404
  - Result: "Privacy policy URL published" and "Terms of service URL published" remain unchecked.

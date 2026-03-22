# C8 Remaining Validation

Date: 2026-02-22
Scope: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.3`

## C8.3 Evidence Snapshot

Sources used:
- telemetry samples under `docs/release/evidence/telemetry/`
- local mobile build artifacts (`.apk`, `.ipa`) if present
- fallback existing evidence docs for APK size if no local APK artifact found

Validation block:
- cold_start_android_p95_ms: 608 (samples=20)
- cold_start_ios_p95_ms: n/a (samples=0)
- apk_size_mb: 30.2
- ipa_size_mb: n/a
- background_network_sample: android_p95=0 bytes/min (samples=1), ios_p95=n/a bytes/min (samples=0)
- apk_size_source: apps/companion-user-flutter/build/app/outputs/flutter-apk/app-arm64-v8a-staging-release.apk
- ipa_size_source: n/a

## Current Conclusion

- This file is auto-generated from available artifacts/samples.
- Any `n/a` value indicates required evidence is not yet captured in this workspace.

## Commands for Remaining Capture

- Android startup telemetry samples:
  - `npm run ops:mobile:adb:startup-telemetry`
- Android background network sample:
  - `npm run ops:mobile:adb:network-idle`
- iOS cold start and background network samples:
  - `npm run ops:mobile:ios:c8:set-metrics -- -ColdStartSamplesCsv "2800,2900,3000" -BackgroundNetworkSamplesCsv "0,0,12" -IpaSizeMb "42.1" -Device "<iphone model>" -IosVersion "<version>" -BuildRef "<build>" -Source "<testflight/xcode>" -Notes "<notes>"`
  - provenance file: `docs/release/evidence/mobile-c8-ios-metrics-capture-latest.md`
- C8.3 gate:
  - `npm run mobile:c8:performance:check`

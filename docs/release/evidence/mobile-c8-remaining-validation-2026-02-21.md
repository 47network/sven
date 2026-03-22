# C8 Remaining Validation

Date: 2026-02-21
Scope: `docs/release/checklists/sven-production-parity-checklist-2026.md` -> `C8.3`

## C8.3 Evidence Snapshot

Sources used:
- telemetry samples under `docs/release/evidence/telemetry/`
- local mobile build artifacts (`.apk`, `.ipa`) if present
- fallback existing evidence docs for APK size if no local APK artifact found

Validation block:
- cold_start_android_p95_ms: 3031 (samples=20)
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
  - add numeric lines to `docs/release/evidence/telemetry/cold_start_ios_samples.txt` and `docs/release/evidence/telemetry/background_network_ios_samples.txt`
- C8.3 gate:
  - `npm run mobile:c8:performance:check`

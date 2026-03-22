# Mobile Release Closeout Runbook (2026)

## Goal
Generate all evidence and status artifacts needed to close mobile release checklist items in one execution flow.

## Command
```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/mobile-release-closeout.ps1 `
  -IosBuildRef "ios-rc-build-123" `
  -AndroidBuildRef "android-rc-build-456" `
  -IosTokenPersists pass `
  -IosSignOutRevokes pass `
  -AndroidTokenPersists pass `
  -AndroidSignOutRevokes pass `
  -AndroidCleartextBlocked pass `
  -AndroidSigningAlias "sven-release" `
  -AndroidArtifactPath "apps/companion-mobile/android/app/build/outputs/apk/release/app-release.apk" `
  -AndroidVerifyCommand "apksigner verify --print-certs app-release.apk" `
  -AndroidVerifySummary "Verified signer CN=47network" `
  -IosSigningIdentity "Apple Distribution: 47network" `
  -IosProvisioningProfile "SvenProdProfile" `
  -IosArtifactPath "apps/companion-mobile/ios/build/Sven.ipa" `
  -IosVerifyCommand "codesign -dv --verbose=4 Sven.app" `
  -IosVerifySummary "Code signature valid" `
  -ApproverEngineering "approved" `
  -ApproverSecurity "approved" `
  -ApproverReleaseOwner "approved"
```

## Fast Path Helpers
```powershell
# 1) Write signing evidence first
npm run ops:mobile:set-signing-evidence -- `
  -AndroidSigningAlias "sven-release" `
  -AndroidArtifactPath "apps/companion-mobile/android/app/build/outputs/apk/release/app-release.apk" `
  -AndroidVerifyCommand "apksigner verify --print-certs app-release.apk" `
  -AndroidVerifySummary "Verified signer CN=47network" `
  -IosSigningIdentity "Apple Distribution: 47network" `
  -IosProvisioningProfile "SvenProdProfile" `
  -IosArtifactPath "apps/companion-mobile/ios/build/Sven.ipa" `
  -IosVerifyCommand "codesign -dv --verbose=4 Sven.app" `
  -IosVerifySummary "Code signature valid" `
  -ApproverEngineering "approved" `
  -ApproverSecurity "approved" `
  -ApproverReleaseOwner "approved"

# 2) Write crash/ANR evidence
npm run ops:mobile:set-crash-anr-evidence -- `
  -CrashFreeSessionsPct 99.73 `
  -AnrFreeSessionsPct 99.93 `
  -SampleSizeSessions 18420 `
  -Source "Play Console + Crashlytics RC export"

# 3) Run strict closeout checks
npm run ops:mobile:release:closeout -- `
  -IosBuildRef "ios-rc-build-123" `
  -AndroidBuildRef "android-rc-build-456" `
  -IosTokenPersists pass `
  -IosSignOutRevokes pass `
  -AndroidTokenPersists pass `
  -AndroidSignOutRevokes pass `
  -AndroidCleartextBlocked pass
```

## Outputs
- `docs/release/evidence/mobile-release-signing-2026-02-14.md`
- `docs/release/status/mobile-release-signing-latest.json`
- `docs/release/status/mobile-crash-anr-latest.json`
- `docs/release/status/mobile-device-release-validation.json`
- `docs/release/status/mobile-release-readiness-latest.json`
- `docs/release/status/mobile-closeout-latest.json`

## Notes
- If ADB is connected, collect fresh smoke/perf snapshots before running closeout.
- Device farm workflow still requires real cloud execution to satisfy its checklist item.

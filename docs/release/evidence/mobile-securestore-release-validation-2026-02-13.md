# Mobile SecureStore Release Validation

Date: 2026-02-13

## Automated Evidence (Completed)

- Release check script: `npm run mobile:securestore:check`
- Latest result:
  - `docs/release/status/mobile-securestore-release-check.json`
  - `docs/release/status/mobile-securestore-release-check.md`
- Current status: `pass`
  - `expo-secure-store` dependency present.
  - SecureStore read/write/delete calls present in mobile app.
  - AsyncStorage token fallback restricted to dev-only behavior.
  - Android cleartext disabled: `android.usesCleartextTraffic=false`.
  - Platforms include iOS and Android.

## CI Workflow Status

- Added workflow: `.github/workflows/mobile-auth-session-smoke.yml`.
- Current status:
  - Branch CI run succeeded (push): `21991843375`
  - Branch CI run succeeded (pull_request): `21991844825`
  - Branch CI run succeeded after `logout-all` integration: `21992091511`
  - URLs:
    - `https://github.com/47matrix/thesven/actions/runs/21991843375`
    - `https://github.com/47matrix/thesven/actions/runs/21991844825`
    - `https://github.com/47matrix/thesven/actions/runs/21992091511`

## Remaining Validation (Device/Release Path)

- iOS release build validation:
  - Build release artifact.
  - Confirm sign-in token persists across app restart.
  - Confirm token is removed on sign-out and session expires correctly after forced revocation.
- Android release build validation:
  - Build release artifact.
  - Confirm same persistence/removal/revocation flow.
  - Confirm no HTTP cleartext gateway fallback is used in release build.

## Execution Command For Final Device Evidence

After running the real iOS/Android release checks, run:

```powershell
npm run mobile:release:device-validate -- `
  -IosBuildRef "<ios-build-id-or-link>" `
  -AndroidBuildRef "<android-build-id-or-link>" `
  -IosTokenPersists pass `
  -IosSignOutRevokes pass `
  -AndroidTokenPersists pass `
  -AndroidSignOutRevokes pass `
  -AndroidCleartextBlocked pass
```

Outputs:
- `docs/release/status/mobile-device-release-validation.json`
- `docs/release/status/mobile-device-release-validation.md`

Ops wrapper alternative:

```sh
sh scripts/ops/sh/ops.sh mobile release-device-validate -- \
  -IosBuildRef "<ios-build-id-or-link>" \
  -AndroidBuildRef "<android-build-id-or-link>" \
  -IosTokenPersists pass \
  -IosSignOutRevokes pass \
  -AndroidTokenPersists pass \
  -AndroidSignOutRevokes pass \
  -AndroidCleartextBlocked pass
```

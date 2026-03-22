# Ops Scripts (Consolidated)

Canonical operational scripts now live under `scripts/ops/`:

- `scripts/ops/mobile/install-nvm.ps1`
- `scripts/ops/mobile/start-expo.ps1`
- `scripts/ops/mobile/monitor-expo-run.ps1`
- `scripts/ops/mobile/capture-legal-phone-network-path-probe.ps1`
- `scripts/ops/mobile/capture-android-network-dns-diagnostic.ps1`
- `scripts/ops/mobile/generate-ios-c8-input-template.ps1`
- `scripts/ops/mobile/set-mobile-release-signing-evidence.ps1`
- `scripts/ops/mobile/set-mobile-crash-anr-evidence.ps1`
- `scripts/ops/device/confirm-device-code.ps1`
- `scripts/ops/device/approve-device-code-db.ps1`
- `scripts/ops/device/auto-approve-from-ui.ps1`
- `scripts/ops/device/query-session.ps1`
- `scripts/ops/release/set-final-signoff.ps1`

Operational prep helpers:

- `npm run ops:mobile:prep-release-evidence`
- `npm run ops:release:prep-final-signoff`
- `npm run ops:release:prep-rollout`
- `npm run ops:release:prep-all`

Legacy root scripts remain as compatibility wrappers and should be treated as deprecated entrypoints.

## Shell Coverage (`.sh`)

OpenClaw-style shell entrypoints are now in `scripts/ops/sh/`:

- `scripts/ops/sh/release-soak-start.sh`
- `scripts/ops/sh/release-soak-status.sh`
- `scripts/ops/sh/release-soak-stop.sh`
- `scripts/ops/sh/release-status.sh`
- `scripts/ops/sh/release-post-verify.sh`
- `scripts/ops/sh/release-gate.sh`
- `scripts/ops/sh/release-gate-set.sh`
- `scripts/ops/sh/mobile-start-expo.sh`
- `scripts/ops/sh/mobile-preflight.sh`
- `scripts/ops/sh/device-confirm.sh`
- `scripts/ops/sh/device-approve-db.sh`
- `scripts/ops/sh/device-query-session.sh`
- `scripts/ops/sh/device-auto-approve-ui.sh`
- `scripts/ops/sh/mobile-newarch-check.sh`

These are the canonical shell ops scripts for parity with infra-heavy repositories.
Current count: `63` shell scripts in `scripts/ops/sh/` (includes release, quality, docker, dev service launchers, db, mobile, device, and ingress flows).

You can list all shell entrypoints with:

```sh
sh scripts/ops/sh/list.sh
```

Primary shell interface:

```sh
sh scripts/ops/sh/ops.sh list
sh scripts/ops/sh/ops.sh release soak status
sh scripts/ops/sh/ops.sh qa lint
sh scripts/ops/sh/ops.sh dev gateway
sh scripts/ops/sh/ops.sh ingress smoke-47matrix
sh scripts/ops/sh/diagnose-47matrix-ingress.sh
sh scripts/ops/sh/ops.sh ingress install-systemd-core /opt/sven/app
```

Shell CI command:

```sh
sh scripts/ops/sh/ci-check.sh
```

Legacy-to-canonical migration map:

- `docs/ops/script-migration-map.md`

## Examples

Recommended release-prep order:

1. `npm run ops:release:prep-all`
2. Let soak continue and monitor with `npm run release:soak:status`.
3. Work rollout first from `docs/release/status/release-rollout-next-steps.ps1`.
4. Work mobile evidence next from `docs/release/status/mobile-release-next-steps.ps1`.
5. Work final signoff from `docs/release/status/release-ops-next-steps.ps1`.
6. Re-run `npm run release:status -- --strict`.

If you want the same information in one JSON payload, run:

- `npm run ops:release:prep-all`

`ops:mobile:prep-release-evidence` now surfaces:

- the active mobile define bundle source
- repo-observed Firebase Android values
- the exact missing release values that still need operator input
- persisted artifacts:
  - `docs/release/status/mobile-release-prep-latest.json`
  - `docs/release/status/mobile-release-prep-latest.md`
  - `docs/release/status/mobile-release-next-steps.ps1`
- the dedicated mobile prep artifacts now also include:
  - mobile execution model
  - mobile source materials
  - mobile input mapping
  - blocker-aware mobile next steps in the correct execution order
  - mobile define-file mutation target / backup / rollback command
  - mobile perf-capture hints when the current perf artifact is invalid
- the current RC mobile scope is now explicit:
  - `android-only`
  - iOS is `deferred`, not passed
- `docs/release/status/mobile-release-next-steps.ps1` is the preferred mobile-only handoff:
  - it exposes editable mobile variables at the top
  - it validates only mobile inputs
  - it can be used without filling rollout or signoff placeholders
  - for the current Android-only RC it does not require `IosBuildRef` or iOS signing inputs

`ops:release:prep-final-signoff` now surfaces:

- per-role selected signoff docs
- per-role failing checks from `final-signoff-latest.json`
- default `staging_evidence_url` and `dashboard_url` values used in the emitted commands

`ops:release:prep-rollout` now surfaces:

- the current rollout checker failures
- the selected rollout execution evidence file
- the emitted setter command for canonical rollout execution evidence
- persisted artifacts:
  - `docs/release/status/release-rollout-prep-latest.json`
  - `docs/release/status/release-rollout-prep-latest.md`
  - `docs/release/status/release-rollout-next-steps.ps1`
- the dedicated rollout json now also includes:
  - rollout execution model
  - rollout next steps
- the dedicated rollout markdown now also includes:
  - rollout execution model
  - rollout artifact paths
  - rollout defaults
  - rollout next steps
- `docs/release/status/release-rollout-next-steps.ps1` is the preferred rollout-only handoff:
  - it exposes editable rollout variables at the top
  - it validates only rollout inputs
  - it can be used without filling mobile or signoff placeholders
  - it should be the first active evidence lane while soak is already running

`ops:release:prep-all` also writes:

- `docs/release/status/release-ops-prep-latest.json`
- `docs/release/status/release-ops-prep-latest.md`
- `docs/release/status/release-ops-next-steps.ps1`
- the combined rollout section in those artifacts now also includes:
  - rollout source materials
  - canary evidence templates
  - rollback runbook references

The JSON/markdown prep artifacts now also show the mobile define-file mutation details:

- target file
- backup file
- rollback command

They also show the execution model explicitly:

- soak commands do not require mobile or signoff placeholders
- mobile sections require only mobile inputs
- signoff sections require only signoff approver inputs

`release-ops-next-steps.ps1` is the preferred operator handoff file:

- it includes the current blocker summary
- it lists the exact missing mobile/signoff inputs
- it exposes editable variables at the top
- the commands below those variables are ready to run after you fill the placeholders required for that section
- soak commands can be run immediately without first filling mobile or signoff placeholders
- mobile define-file and mobile evidence steps validate only the mobile inputs they need
- signoff regeneration steps validate only the signoff approver inputs they need
- when it updates `config/env/mobile-dart-defines.release.local.json`, it first writes `config/env/mobile-dart-defines.release.local.json.bak`
- the generated script also prints the rollback command for restoring that backup
- when soak is already running, the practical execution order is:
  - rollout
  - mobile
  - signoff
  - final strict status rerun

```powershell
npm run ops:mobile:prep-release-evidence
```

```powershell
npm run ops:release:prep-final-signoff
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/start-expo.ps1 -NodeMode auto
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-release-signing-evidence.ps1 `
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

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/mobile/set-mobile-crash-anr-evidence.ps1 `
  -CrashFreeSessionsPct 99.73 `
  -AnrFreeSessionsPct 99.93 `
  -SampleSizeSessions 18420 `
  -Source "Play Console + Crashlytics RC export"
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ops/device/confirm-device-code.ps1 -GatewayUrl http://localhost:3000 -UserCode ABCD-1234 -Mode login -Username 47 -Password change-me-in-production
```

```sh
USER_CODE=ABCD-1234 MODE=login GATEWAY_URL=http://localhost:3000 sh scripts/ops/sh/device-confirm.sh
```

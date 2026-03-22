# Mobile Device Farm Automation (Maestro Cloud)

Date: 2026-02-14

## Goal

Run automated mobile UI smoke flows on real cloud devices for both Android and iOS.

## Workflow

- CI workflow: `.github/workflows/mobile-device-farm.yml`
- Android job:
  - prebuild Android native project
  - build debug APK
  - run Maestro cloud flow `apps/companion-mobile/.maestro/flows/android-smoke.yaml`
- iOS job:
  - prebuild iOS native project
  - build simulator `.app`
  - run Maestro cloud flow `apps/companion-mobile/.maestro/flows/ios-smoke.yaml`

## Secrets Required

- `MAESTRO_CLOUD_API_KEY`

Without this secret, workflow skips cloud execution steps and exits cleanly with a skip notice.

## Local Config Validation

```powershell
npm run mobile:devicefarm:config:check
```

Artifacts:
- `docs/release/status/mobile-device-farm-config-latest.json`
- `docs/release/status/mobile-device-farm-config-latest.md`

## Results Validation (Release Gate)

After running the workflow with the secret set, record the run metadata:

- `docs/release/evidence/mobile-device-farm-results-2026-02-14.md`

Then validate:

```powershell
npm run mobile:devicefarm:results:check -- --strict
```

Or sync directly from GitHub Actions (requires `gh auth login`):

```powershell
npm run ops:mobile:devicefarm:sync-results -- -Branch master
```

Artifacts:
- `docs/release/status/mobile-device-farm-latest.json`
- `docs/release/status/mobile-device-farm-latest.md`

# Testing Strategy Phase 3 Mobile Device Farm (2026-02-14)

## Scope Completed

- Implemented cross-platform cloud device-farm automation lane for mobile.
- Added Maestro flow definitions for Android and iOS smoke coverage.
- Added CI workflow for Android/iOS build + Maestro cloud execution.
- Added local config verification gate and status artifacts.

## Artifacts

- `.github/workflows/mobile-device-farm.yml`
- `scripts/ops/mobile/maestro-cloud-run.sh`
- `apps/companion-mobile/.maestro/flows/android-smoke.yaml`
- `apps/companion-mobile/.maestro/flows/ios-smoke.yaml`
- `scripts/mobile-device-farm-config-check.cjs`
- `docs/ops/mobile-device-farm-maestro-2026.md`
- `docs/release/status/mobile-device-farm-config-latest.json`

## Validation Run

```powershell
npm run mobile:devicefarm:config:check
```

Result:

- configuration status: `pass`

## Pending to Mark DoD Complete

- Execute `.github/workflows/mobile-device-farm.yml` with `MAESTRO_CLOUD_API_KEY` set.
- Require both jobs (`android-maestro-cloud` and `ios-maestro-cloud`) to pass on latest commit.
- Record run metadata in `docs/release/evidence/mobile-device-farm-results-2026-02-14.md`.
- Validate results gate with:

```powershell
npm run mobile:devicefarm:results:check -- --strict
```

## Latest Attempt

- Run URL: `https://github.com/47matrix/thesven/actions/runs/22025581436`
- Result: workflow succeeded with both jobs skipped
- Reason: `MAESTRO_CLOUD_API_KEY` is missing; smoke steps were not executed
- Gate impact: remains blocked until both Android and iOS smoke steps execute and pass on the same commit
- Temporary exception record: `docs/release/evidence/mobile-device-farm-exception-2026-02-14.md`

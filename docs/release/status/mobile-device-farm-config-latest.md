# Mobile Device Farm Config Check

Status: pass

## Checks
- [x] exists:.github/workflows/mobile-device-farm.yml
- [x] exists:scripts/ops/mobile/maestro-cloud-run.sh
- [x] exists:apps/companion-mobile/.maestro/flows/android-smoke.yaml
- [x] exists:apps/companion-mobile/.maestro/flows/ios-smoke.yaml
- [x] workflow:has_android_job
- [x] workflow:has_ios_job
- [x] workflow:uses_maestro_secret


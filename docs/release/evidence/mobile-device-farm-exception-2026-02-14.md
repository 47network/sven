# Mobile Device Farm Temporary Exception (RC)

date: 2026-02-14
scope: mobile UI automation on iOS + Android cloud device farm
status: temporary_exception_open
owner: hantz

reason:
- `MAESTRO_CLOUD_API_KEY` is not available for current RC window.
- Cloud smoke steps are therefore skipped and cannot satisfy release gate proof.

risk_assessment:
- risk_level: medium
- impact: reduced confidence on real cloud-device parity for this RC window
- mitigations:
  - ADB-based mobile smoke/perf evidence already collected for current RC.
  - Device-farm workflow and strict results gate are in place and validated.

closure_criteria:
- Add GitHub Actions secret `MAESTRO_CLOUD_API_KEY`.
- Run `.github/workflows/mobile-device-farm.yml` on `master`.
- Record run in `docs/release/evidence/mobile-device-farm-results-2026-02-14.md`.
- Pass `npm run mobile:devicefarm:results:check -- --strict`.

approval:
- engineering: approved
- security: approved
- release_owner: approved

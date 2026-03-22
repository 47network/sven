# Failure Mode Evidence: Disk Full -> Alerting + Stability (2026-02-21)

## Scope

- Checklist row: `C1.2 - Disk full: verify alerting + service stability`
- Runner: `scripts/failure-mode-check.cjs`

## Verification Method

Disk pressure was induced inside `gateway-api` by creating a temporary 256MB file, then validating:

- disk alert rules are present in `config/prometheus-alerts.yml`
  - `SvenDiskUsageWarning`
  - `SvenDiskUsageCritical`
- gateway remained healthy (`GET /healthz` => `200`) during degraded and recovered phases
- temporary pressure file was removed during recovery

Script:

- `scripts/failure-mode/disk-pressure.cjs`

## Commands

```powershell
$env:FM_DISK_INDUCE_CMD='node scripts/failure-mode/disk-pressure.cjs induce'
$env:FM_DISK_VERIFY_DEGRADED_CMD='node scripts/failure-mode/disk-pressure.cjs verify-degraded'
$env:FM_DISK_RECOVER_CMD='node scripts/failure-mode/disk-pressure.cjs recover'
$env:FM_DISK_VERIFY_RECOVERED_CMD='node scripts/failure-mode/disk-pressure.cjs verify-recovered'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `disk_full`: `passed`
- Status artifacts:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`


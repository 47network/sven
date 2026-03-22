# Failure Mode Evidence: OOM-Class Crash -> Restart + Recovery (2026-02-21)

## Scope

- Checklist row: `C1.2 - OOM: verify container restart with state recovery`
- Runner: `scripts/failure-mode-check.cjs`

## Verification Method

An OOM-class abrupt termination was simulated with `SIGKILL` on the `gateway-api` container process, then verified:

- degraded state observed (`gateway-api` stopped after kill)
- recovery command brought service back (`docker compose up -d gateway-api`)
- container startup evidence changed (new start-time/restart evidence)
- gateway health endpoint recovered (`GET /healthz` => `200`)

Script:

- `scripts/failure-mode/oom-restart.cjs`

## Commands

```powershell
$env:FM_OOM_INDUCE_CMD='node scripts/failure-mode/oom-restart.cjs induce'
$env:FM_OOM_VERIFY_DEGRADED_CMD='node scripts/failure-mode/oom-restart.cjs verify-degraded'
$env:FM_OOM_RECOVER_CMD='node scripts/failure-mode/oom-restart.cjs recover'
$env:FM_OOM_VERIFY_RECOVERED_CMD='node scripts/failure-mode/oom-restart.cjs verify-recovered'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `oom_restart`: `passed`
- Status artifacts:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`
- State capture artifact:
  - `docs/release/status/failure-mode-oom-state.json`


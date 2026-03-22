# Failure Mode Evidence: NATS Disconnect + Replay (2026-02-21)

## Scope

- Checklist row: `C1.2 - NATS disconnect: verify reconnection + message replay`
- Runner: `scripts/failure-mode-check.cjs`

## Commands

```powershell
$env:FM_NATS_INDUCE_CMD='node scripts/failure-mode/nats-induce.cjs && docker compose stop nats'
$env:FM_NATS_VERIFY_DEGRADED_CMD='powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(45); do { $code=0; try { $resp=Invoke-WebRequest -Uri ''http://localhost:3000/healthz'' -UseBasicParsing; $code=[int]$resp.StatusCode } catch { if ($_.Exception.Response) { $code=[int]$_.Exception.Response.StatusCode.value__ } }; if ($code -eq 503) { exit 0 }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"'
$env:FM_NATS_RECOVER_CMD='docker compose start nats'
$env:FM_NATS_VERIFY_RECOVERED_CMD='node scripts/failure-mode/nats-verify-recovered.cjs'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `nats_disconnect`: `passed`
- Degraded-state verification: `/healthz` observed `503` while NATS stopped
- Recovery verification:
  - gateway returned healthy after `docker compose start nats`
  - JetStream replay validated by reading the pre-restart marker message sequence from stream storage
- Status artifact:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`

## Supporting Scripts

- `scripts/failure-mode/nats-induce.cjs`
- `scripts/failure-mode/nats-verify-recovered.cjs`


# Failure Mode Evidence: PostgreSQL Pool Exhaustion (2026-02-21)

## Scope

- Checklist row: `C1.2 - PostgreSQL connection pool exhaustion: verify graceful degradation`
- Runner: `scripts/failure-mode-check.cjs`

## Command

```powershell
$env:FM_POSTGRES_INDUCE_CMD='docker compose stop postgres'
$env:FM_POSTGRES_VERIFY_DEGRADED_CMD='powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(45); do { $code=0; try { $resp=Invoke-WebRequest -Uri ''http://localhost:3000/healthz'' -UseBasicParsing; $code=[int]$resp.StatusCode } catch { if ($_.Exception.Response) { $code=[int]$_.Exception.Response.StatusCode.value__ } }; if ($code -eq 503) { exit 0 }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"'
$env:FM_POSTGRES_RECOVER_CMD='docker compose start postgres'
$env:FM_POSTGRES_VERIFY_RECOVERED_CMD='powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(120); do { $h=0; $r=0; try { $h=[int](Invoke-WebRequest -Uri ''http://localhost:3000/healthz'' -UseBasicParsing).StatusCode } catch {}; try { $r=[int](Invoke-WebRequest -Uri ''http://localhost:3000/readyz'' -UseBasicParsing).StatusCode } catch {}; if ($h -eq 200 -and $r -eq 200) { exit 0 }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `postgres_pool_exhaustion`: `passed`
- Degraded-state verification: `/healthz` observed `503`
- Recovery verification: `/healthz` + `/readyz` returned `200` after postgres restart
- Status artifact:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`


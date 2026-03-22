# Failure Mode Evidence: LLM Provider Down -> Fallback (2026-02-21)

## Scope

- Checklist row: `C1.2 - LLM provider down: verify failover to next provider`
- Runner: `scripts/failure-mode-check.cjs`

## Verification Method

Deterministic failover simulation using the real `LLMRouter` build:

- Primary model (`local-primary` / Ollama path) forced to return `503`
- Router must automatically retry with fallback cloud model (`cloud-fallback`)
- Verification script asserts both attempts occurred and fallback response succeeded

Script:

- `scripts/failure-mode/llm-provider-failover.cjs`

## Commands

```powershell
$env:FM_LLM_INDUCE_CMD='powershell -NoProfile -Command "Write-Output llm-primary-provider-down-simulated"'
$env:FM_LLM_VERIFY_DEGRADED_CMD='node scripts/failure-mode/llm-provider-failover.cjs'
$env:FM_LLM_RECOVER_CMD='powershell -NoProfile -Command "Write-Output llm-provider-recovery-simulated"'
$env:FM_LLM_VERIFY_RECOVERED_CMD='powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $gw=[int](Invoke-WebRequest -Uri ''http://localhost:3000/healthz'' -UseBasicParsing).StatusCode; if ($gw -eq 200) { exit 0 } } catch {}; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `llm_provider_down`: `passed`
- Router log evidence in simulation:
  - primary provider failed
  - fallback model selected
  - response returned from fallback provider
- Status artifact:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`


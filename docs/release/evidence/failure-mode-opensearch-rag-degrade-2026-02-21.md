# Failure Mode Evidence: OpenSearch Down -> RAG Degrade (2026-02-21)

## Scope

- Checklist row: `C1.2 - OpenSearch down: verify RAG degrades to vector-only (pgvector)`
- Runner: `scripts/failure-mode-check.cjs`

## Commands

```powershell
$env:FM_OPENSEARCH_INDUCE_CMD='docker compose up -d opensearch && docker compose stop opensearch'
$env:FM_OPENSEARCH_VERIFY_DEGRADED_CMD='node scripts/failure-mode/verify-rag-degraded.cjs'
$env:FM_OPENSEARCH_RECOVER_CMD='docker compose up -d opensearch'
$env:FM_OPENSEARCH_VERIFY_RECOVERED_CMD='powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(180); do { $os=0; $gw=0; try { $os=[int](Invoke-WebRequest -Uri ''http://localhost:9200/_cluster/health'' -UseBasicParsing).StatusCode } catch {}; try { $gw=[int](Invoke-WebRequest -Uri ''http://localhost:3000/healthz'' -UseBasicParsing).StatusCode } catch {}; if ($os -eq 200 -and $gw -eq 200) { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"'
node scripts/failure-mode-check.cjs --api-url http://localhost:3000
```

## Result

- Scenario `opensearch_down`: `passed`
- Degraded-state verification:
  - admin RAG search endpoint remained available
  - response metadata reported `degraded_vector_only=true` while OpenSearch was offline
- Recovery verification:
  - OpenSearch cluster health endpoint returned `200`
  - gateway `/healthz` returned `200`
- Status artifact:
  - `docs/release/status/failure-mode-latest.json`
  - `docs/release/status/failure-mode-latest.md`

## Supporting Changes

- OpenSearch outage fallback in admin RAG search:
  - `services/gateway-api/src/routes/admin/rag.ts`
- Scenario verifier:
  - `scripts/failure-mode/verify-rag-degraded.cjs`


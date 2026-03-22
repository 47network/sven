# API Contract Versioning Phase 1

Date: 2026-02-13  
Scope: Add explicit API contract version metadata and test coverage.

## Implemented

### 1. Gateway contract metadata source

File:
- `services/gateway-api/src/contracts/api-contract.ts`

Exports:
- `API_CONTRACT_VERSION` (`2026-02-13.v1`)
- `API_CONTRACT_SURFACES` (`auth`, `chat`, `approvals`, `admin`, `stats`)
- `API_CONTRACT_HEADER` (`x-sven-contract-version`)

### 2. Runtime contract signaling

Files:
- `services/gateway-api/src/index.ts`
- `services/gateway-api/src/routes/health.ts`

Changes:
- Adds response header on all responses:
  - `x-sven-contract-version: 2026-02-13.v1`
- Adds public endpoint:
  - `GET /v1/contracts/version`
  - returns version + surface list.

### 3. Test and release check coverage

Files:
- `services/gateway-api/src/__tests__/api-contract.version.test.ts`
- `scripts/api-contract-version-check.cjs`
- `package.json` script: `release:api:contract:check`

Status artifacts:
- `docs/release/status/api-contract-version-latest.json`
- `docs/release/status/api-contract-version-latest.md`

## Validation

- `npm --prefix services/gateway-api run build` (pass)
- `npm --prefix services/gateway-api run test -- --runTestsByPath src/__tests__/api-contract.version.test.ts` (pass)
- `node scripts/api-contract-version-check.cjs` (pass)

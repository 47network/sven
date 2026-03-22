# API Contract Version Check

Generated: 2026-02-22T06:18:02.666Z
Status: pass
Passed: 5
Failed: 0

## Checks
- [x] shared_contract_file_exists: packages/shared/src/contracts/api-contract.ts exports API_CONTRACT_VERSION
- [x] shared_contract_version_format: version matches YYYY-MM-DD.vN
- [x] gateway_contract_endpoint: services/gateway-api/src/routes/health.ts includes /v1/contracts/version
- [x] gateway_contract_header_hook: services/gateway-api/src/index.ts injects contract header
- [x] contract_version_test_present: services/gateway-api/src/__tests__/api-contract.version.test.ts validates contract metadata


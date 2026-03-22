# D2 Tenant Isolation Phase 1 (2026-02-22)

## Scope

Added automated cross-account (tenant) isolation verification for key surfaces using account switching.

- New e2e test:
  - `services/gateway-api/src/__tests__/tenant-isolation.e2e.ts`
- Test flow:
  - Creates Account A and Account B using `/v1/accounts`.
  - In Account A, creates:
    - registry source + catalog entry
    - chat
    - web-domain allowlist entry
    - tenant setting override (`/v1/admin/settings/llm.defaultModel`)
  - Activates Account B and verifies:
    - Account A catalog/chat are not listed
    - Account A allowlist entry is not listed in:
      - `GET /v1/admin/allowlists?type=web_domain`
      - `GET /v1/admin/web/allowlist`
    - direct install by Account A catalog id returns 404
    - direct chat read by Account A chat id returns 404
    - direct delete by Account A allowlist id returns 404
    - Account B setting view does not leak Account A override value
  - Reactivates Account A and confirms Account A catalog visibility remains intact.

## Local verification

- Command:
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/tenant-isolation.e2e.ts`
- Result:
  - PASS (1 suite, 1 test)

## Notes

- This phase verifies tenant scoping behavior at API/runtime level.
- It does not yet implement physical isolation strategy (database-per-tenant or schema-per-tenant).

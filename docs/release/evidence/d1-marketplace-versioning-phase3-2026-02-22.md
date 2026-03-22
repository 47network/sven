# D1 Marketplace Versioning Phase 3 (2026-02-22)

## Scope

Implemented skill version history and deprecation/changelog visibility for D1 without external dependency:

- Added API endpoint:
  - `GET /api/v1/admin/registry/versions?name=<skillName>`
  - Returns full version history for a skill name ordered by `created_at DESC`.
  - Includes extracted metadata from `manifest`:
    - `changelog`
    - `deprecation_notice`
    - `deprecated` boolean
- Extended marketplace projection endpoint:
  - `GET /api/v1/admin/registry/marketplace`
  - Now includes latest-entry `changelog`, `deprecation_notice`, and `deprecated` status for cards.
- Canvas `/skills` updates:
  - Added `Versions` action per skill card.
  - Added version history panel rendering latest versions + timestamps + changelog + deprecation notice.
  - Added deprecated badge + deprecation text on marketplace cards.

## Files

- `services/gateway-api/src/routes/admin/registry.ts`
- `apps/canvas-ui/src/lib/api.ts`
- `apps/canvas-ui/src/lib/hooks.ts`
- `apps/canvas-ui/src/app/skills/page.tsx`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/canvas-ui typecheck` -> pass

## Remaining

- Version publication governance (approval flow for release notes/deprecation policy) is still process/documentation work; API/UI support now exists.

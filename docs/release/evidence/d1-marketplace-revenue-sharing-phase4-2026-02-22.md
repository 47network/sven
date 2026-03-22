# D1 Marketplace Revenue Sharing Phase 4 (2026-02-22)

## Scope

Implemented a local revenue-sharing model for premium skills (no external payment gateway required for verification):

- Added migration:
  - `services/gateway-api/src/db/migrations/118_registry_revenue_sharing.sql`
  - New tables:
    - `skill_monetization_rules`
    - `skill_purchase_events`
- Added registry monetization APIs:
  - `GET /api/v1/admin/registry/monetization`
  - `POST /api/v1/admin/registry/monetization` (upsert premium pricing + creator split)
  - `POST /api/v1/admin/registry/purchase/:id` (records purchase event + creator/platform split)
  - `GET /api/v1/admin/registry/payouts/summary` (creator payout aggregate)
- Extended marketplace projection:
  - `GET /api/v1/admin/registry/marketplace` now includes:
    - `is_premium`, `price_cents`, `currency`, `creator_share_bps`
- Canvas `/skills`:
  - Shows premium pricing on cards.
  - Premium skills use `Buy + Install` flow:
    - records purchase split via purchase API
    - then executes install

## Files

- `services/gateway-api/src/db/migrations/118_registry_revenue_sharing.sql`
- `services/gateway-api/src/routes/admin/registry.ts`
- `apps/canvas-ui/src/lib/api.ts`
- `apps/canvas-ui/src/lib/hooks.ts`
- `apps/canvas-ui/src/app/skills/page.tsx`

## Local verification

- `npm run --workspace @sven/gateway-api build` -> pass
- `npm run --workspace @sven/canvas-ui typecheck` -> pass

## Remaining

- External payment processor integration, tax handling, chargebacks/refunds workflow, and invoicing are still pending.

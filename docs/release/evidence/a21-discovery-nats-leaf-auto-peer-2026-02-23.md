# A21 Discovery Optional NATS Leaf Auto-Peer (2026-02-23)

## Scope

- Complete A21 optional parity item: NATS leaf-node auto-peering foundation from LAN discovery.
- Keep implementation Sven-native and optional (default off).

## Implementation

- Discovery service enhancements:
  - `services/gateway-api/src/services/DiscoveryService.ts`
  - Advertises `nats_leaf_url` in mDNS TXT records when `DISCOVERY_NATS_LEAF_URL` or `NATS_LEAF_URL` is configured.
  - Adds setting-gated peer collection: `discovery.natsLeafAutoPeer.enabled` (default false).
  - Tracks discovered peer candidates from TXT records and persists them to:
    - `settings_global.key = discovery.natsLeafAutoPeer.peers`
- Admin API payload expansion:
  - `services/gateway-api/src/routes/admin/discovery.ts`
  - Returns:
    - `nats_leaf_auto_peer_enabled`
    - `nats_leaf_peers`
- Admin UI visibility:
  - `apps/admin-ui/src/app/discovery/page.tsx`
  - Adds "NATS Leaf Auto-Peer Candidates" panel with discovered peer URLs and last-seen timestamps.
  - `apps/admin-ui/src/lib/api.ts` updated types for new discovery fields.
- Database migration:
  - `services/gateway-api/src/db/migrations/148_discovery_nats_leaf_auto_peer_settings.sql`
  - `services/gateway-api/src/db/rollbacks/148_discovery_nats_leaf_auto_peer_settings.sql`

## Verification

- Targeted discovery tests:
  - `pnpm --dir services/gateway-api run test -- --runInBand src/__tests__/discovery.test.ts`
  - Result: PASS (3/3)
  - Includes new coverage for NATS leaf peer candidate ingestion and persistence path.
- Admin UI typecheck:
  - `pnpm --dir apps/admin-ui run typecheck`
  - Result: PASS

## Notes

- This delivers optional auto-peer discovery foundation and operator visibility.
- It does not force runtime NATS topology rewiring; peer candidates remain explicitly gated and observable.

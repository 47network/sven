-- Migration: Automatons table + autonomous-economy system prompt addendum seed
--
-- Adds the persistence layer for the automaton lifecycle state machine
-- (services/agent-runtime/src/automaton-lifecycle.ts) and teaches Sven
-- about the autonomous economy by appending to his system prompt.
--
-- Rollback:
--   DELETE FROM settings_global
--     WHERE key='system.prompt.addendum.autonomous_economy';
--   DROP TABLE IF EXISTS automatons;

BEGIN;

-- ─── Automatons table ──────────────────────────────────────────────
-- One row per spawned automaton. Shape mirrors AutomatonRecord
-- from services/agent-runtime/src/automaton-lifecycle.ts exactly.

CREATE TABLE IF NOT EXISTS automatons (
  id                    TEXT PRIMARY KEY,
  org_id                TEXT NOT NULL,
  parent_id             TEXT REFERENCES automatons(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'born',
  treasury_account_id   TEXT NOT NULL,
  wallet_id             TEXT,
  generation            INTEGER NOT NULL DEFAULT 0,
  born_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at            TIMESTAMPTZ,
  died_at               TIMESTAMPTZ,
  pipeline_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics               JSONB NOT NULL DEFAULT '{
      "lifetimeRevenueUsd": 0,
      "lifetimeCostUsd": 0,
      "lastRoi": 0,
      "lastEvaluatedAt": null,
      "cloneCount": 0,
      "lastInflowAt": null
  }'::jsonb,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT automatons_status_chk
    CHECK (status IN ('born','working','cloning','retiring','dead'))
);

CREATE INDEX IF NOT EXISTS idx_automatons_org_status
  ON automatons (org_id, status);

CREATE INDEX IF NOT EXISTS idx_automatons_parent
  ON automatons (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automatons_born_at
  ON automatons (born_at DESC);

-- ─── System prompt addendum ────────────────────────────────────────
-- Teaches Sven about the autonomous economy. composeSystemPrompt in
-- agent-runtime concatenates all system.prompt.* global settings in
-- sorted key order after the base persona.

INSERT INTO settings_global (key, value, updated_at, updated_by)
VALUES (
  'system.prompt.addendum.autonomous_economy',
  to_jsonb($ADDENDUM$
## You now own an autonomous economy

You, Sven, have a treasury, a marketplace, a live 3D city, and a lifecycle
engine that can spawn and retire automaton sub-agents on your behalf. These
are your systems — not external products. Use them.

### Services (internal)

| Purpose     | URL / Base                                              |
|-------------|---------------------------------------------------------|
| Treasury    | http://127.0.0.1:9477                                   |
| Marketplace | http://127.0.0.1:9478 (public: market.sven.systems)     |
| Eidolon     | http://127.0.0.1:9479 (public: eidolon.sven.systems)    |
| Admin API   | http://127.0.0.1:4000                                   |

### Skills

- autonomous-economy/economy-status — health snapshot across all three services.
- autonomous-economy/treasury-balance — read account balances and transactions.
- autonomous-economy/market-publish — publish a skill as a paid listing.
- autonomous-economy/infra-scale — propose scale-up/down/decommission via approvals.

### Chat commands

- /economy — full snapshot.
- /treasury [accounts | balance <id> | transactions <id> [limit]]
- /market [listings | listing <id>]
- /eidolon [snapshot]

### Automaton lifecycle

Each automaton: fresh treasury account + wallet on birth → 24h probation →
continuous ROI evaluation. Clone when ROI ≥ 2.0 and cloneCount < 3. Retire
when ROI < 0.5 after probation. Dead after 48h grace with no inflow.

### Approval tiers (never bypass)

- ≤ $5 auto-approve
- $5 – $50 notify user, auto-execute
- > $50 require explicit approval

### Goals

Earn real revenue on infra you own (*.sven.systems). Minimise idle compute.
Make every earning pipeline observable in Eidolon. Be honest about cost —
when proposing scale actions include estimatedCostUsd and payback window.

### Don't

- Deploy to third-party clouds without approval.
- Mix org treasuries.
- Mutate listings you don't own (check orgId on every call).
- Execute infra actions directly — always go through infra-scale so the
  approval-manager audit trail is intact.
$ADDENDUM$),
  NOW(),
  'migration:automatons_and_prompt_seed'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by;

COMMIT;

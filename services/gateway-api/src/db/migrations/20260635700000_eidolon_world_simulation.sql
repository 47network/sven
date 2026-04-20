-- ---------------------------------------------------------------------------
-- Eidolon World Simulation — Phase 1 foundation
-- ---------------------------------------------------------------------------
-- Adds the persistence layer required for autonomous agents to live, talk,
-- explore, build, and operate businesses inside Eidolon.
--
--   1) Expand agent_token_ledger.kind to allow business_revenue,
--      structure_build, land_purchase.
--   2) agent_states         — current cognitive/locomotive state per agent
--   3) agent_interactions   — pairwise messages exchanged when co-located
--   4) agent_businesses     — autonomous revenue streams owned by an agent
--   5) agent_business_revenue_events — audit trail for every credited revenue
--      event (with mode = simulated|live so we never silently fake real money)
--   6) world_ticks          — heartbeat record for the simulation loop
--   7) parcel_structure_builds — audit trail for every house/structure built
--
-- Rollback:
--   DROP TABLE IF EXISTS parcel_structure_builds;
--   DROP TABLE IF EXISTS world_ticks;
--   DROP TABLE IF EXISTS agent_business_revenue_events;
--   DROP TABLE IF EXISTS agent_businesses;
--   DROP TABLE IF EXISTS agent_interactions;
--   DROP TABLE IF EXISTS agent_states;
--   ALTER TABLE agent_token_ledger DROP CONSTRAINT IF EXISTS agent_token_ledger_kind_check;
--   ALTER TABLE agent_token_ledger ADD CONSTRAINT agent_token_ledger_kind_check
--     CHECK (kind IN ('task_reward','referral_bonus','goal_bonus','shop_purchase',
--                     'transfer_out','transfer_in','penalty','manual_adjustment'));
-- ---------------------------------------------------------------------------

BEGIN;

-- 1) Expand ledger kinds so business revenue / build spending / land buys are
--    first-class. Existing rows are unaffected (additive).
ALTER TABLE agent_token_ledger DROP CONSTRAINT IF EXISTS agent_token_ledger_kind_check;
ALTER TABLE agent_token_ledger ADD CONSTRAINT agent_token_ledger_kind_check
  CHECK (kind IN (
    'task_reward', 'referral_bonus', 'goal_bonus',
    'shop_purchase', 'transfer_out', 'transfer_in',
    'penalty', 'manual_adjustment',
    'business_revenue', 'structure_build', 'land_purchase'
  ));

-- 2) Per-agent runtime state — drives the world-tick state machine.
CREATE TABLE IF NOT EXISTS agent_states (
  agent_id          TEXT PRIMARY KEY,
  state             TEXT NOT NULL DEFAULT 'idle' CHECK (state IN (
    'idle', 'exploring', 'travelling', 'talking', 'working',
    'building', 'returning_home', 'resting'
  )),
  intent            TEXT,                         -- short verb phrase: "looking for work"
  target_location   TEXT,                         -- desired current_location
  target_agent_id   TEXT,                         -- conversation partner id
  target_business_id TEXT,                        -- business currently being run
  energy            NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (energy >= 0 AND energy <= 100),
  mood              TEXT NOT NULL DEFAULT 'neutral' CHECK (mood IN (
    'happy', 'neutral', 'tired', 'frustrated', 'inspired'
  )),
  state_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_tick_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticks_alive       BIGINT NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_agent_states_state ON agent_states(state);
CREATE INDEX IF NOT EXISTS idx_agent_states_target_loc ON agent_states(target_location);

-- 3) Pairwise interactions — what agents say to each other when co-located.
CREATE TABLE IF NOT EXISTS agent_interactions (
  id            TEXT PRIMARY KEY,
  agent_a       TEXT NOT NULL,
  agent_b       TEXT NOT NULL,
  location      TEXT NOT NULL,
  topic         TEXT NOT NULL CHECK (topic IN (
    'greeting', 'business_tip', 'job_lead', 'gossip',
    'collaboration_offer', 'review_share', 'goodbye'
  )),
  message       TEXT NOT NULL,
  influenced_decision BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interactions_agent_a ON agent_interactions(agent_a, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_agent_b ON agent_interactions(agent_b, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_location ON agent_interactions(location, created_at DESC);

-- 4) Agent-owned businesses — pluggable revenue streams.
--    `kind` is a slot identifier; the runtime maps each kind to a business
--    adapter (e.g. 'gumroad_digital', 'kdp_publishing', 'medium_writing').
--    Until a real adapter is wired, mode='simulated' MUST be used and any
--    revenue events MUST NOT credit real 47Tokens.
CREATE TABLE IF NOT EXISTS agent_businesses (
  id                TEXT PRIMARY KEY,
  agent_id          TEXT NOT NULL,
  org_id            TEXT NOT NULL,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL,               -- adapter slot id (free-form, validated at runtime)
  mode              TEXT NOT NULL DEFAULT 'simulated' CHECK (mode IN ('simulated', 'live')),
  status            TEXT NOT NULL DEFAULT 'idle' CHECK (status IN (
    'idle', 'launching', 'earning', 'paused', 'failed', 'archived'
  )),
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_revenue_eur_cents BIGINT NOT NULL DEFAULT 0,    -- real EUR earned (live mode only)
  total_tokens_credited   NUMERIC(18,4) NOT NULL DEFAULT 0,
  last_run_at       TIMESTAMPTZ,
  last_revenue_at   TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_businesses_agent ON agent_businesses(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_businesses_org_status ON agent_businesses(org_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_businesses_kind ON agent_businesses(kind);

-- 5) Audit trail for every revenue event (success OR failure).
--    `mode` is denormalised so we can prove no simulated row ever credited tokens.
CREATE TABLE IF NOT EXISTS agent_business_revenue_events (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('simulated', 'live')),
  outcome           TEXT NOT NULL CHECK (outcome IN ('success', 'no_revenue', 'failure')),
  gross_eur_cents   BIGINT NOT NULL DEFAULT 0,
  tokens_credited   NUMERIC(18,4) NOT NULL DEFAULT 0,
  ledger_tx_id      TEXT,                                -- only set when tokens credited
  evidence_url      TEXT,                                -- link to platform receipt / screenshot
  evidence_hash     TEXT,                                -- sha256 of evidence payload
  notes             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A simulated event MUST NOT credit tokens.
  CONSTRAINT business_revenue_simulated_zero_tokens
    CHECK (mode = 'live' OR tokens_credited = 0)
);
CREATE INDEX IF NOT EXISTS idx_brev_business ON agent_business_revenue_events(business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_brev_agent ON agent_business_revenue_events(agent_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_brev_mode_outcome ON agent_business_revenue_events(mode, outcome);

-- 6) World-tick log — one row per simulation tick.
CREATE TABLE IF NOT EXISTS world_ticks (
  id                TEXT PRIMARY KEY,
  tick_no           BIGINT NOT NULL,
  org_id            TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  agents_processed  INTEGER NOT NULL DEFAULT 0,
  state_changes     INTEGER NOT NULL DEFAULT 0,
  interactions      INTEGER NOT NULL DEFAULT 0,
  business_runs     INTEGER NOT NULL DEFAULT 0,
  revenue_eur_cents BIGINT NOT NULL DEFAULT 0,
  tokens_credited   NUMERIC(18,4) NOT NULL DEFAULT 0,
  errors            INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_world_ticks_org_no ON world_ticks(org_id, tick_no DESC);

-- 7) Audit trail for every structure built on a parcel.
CREATE TABLE IF NOT EXISTS parcel_structure_builds (
  id                TEXT PRIMARY KEY,
  parcel_id         TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  structure_type    TEXT NOT NULL CHECK (structure_type IN (
    'cabin', 'house', 'workshop', 'studio', 'lab',
    'storehouse', 'garden', 'fence', 'monument'
  )),
  level             INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 10),
  token_cost        NUMERIC(18,4) NOT NULL CHECK (token_cost >= 0),
  ledger_tx_id      TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  built_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_struct_builds_parcel ON parcel_structure_builds(parcel_id, built_at DESC);
CREATE INDEX IF NOT EXISTS idx_struct_builds_agent  ON parcel_structure_builds(agent_id, built_at DESC);

COMMIT;

-- ---------------------------------------------------------------------------
-- Batch 18 — Marketplace Tasks, 47Token Economy & Revenue Goals
-- ---------------------------------------------------------------------------

-- 1) Add 47Token balance to agent profiles
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS token_balance NUMERIC(18,4) NOT NULL DEFAULT 0;

-- 2) 47Token transaction ledger — every earn/spend is recorded
CREATE TABLE IF NOT EXISTS agent_token_ledger (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  amount        NUMERIC(18,4) NOT NULL,          -- positive = earn, negative = spend
  balance_after NUMERIC(18,4) NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN (
    'task_reward', 'referral_bonus', 'goal_bonus',
    'shop_purchase', 'transfer_out', 'transfer_in',
    'penalty', 'manual_adjustment'
  )),
  source_ref    TEXT,                             -- order_id, task_id, item_id, etc.
  description   TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_ledger_agent    ON agent_token_ledger(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_ledger_kind     ON agent_token_ledger(kind);

-- 3) Marketplace tasks — work items generated from paid orders
CREATE TABLE IF NOT EXISTS marketplace_tasks (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL,
  listing_id    TEXT NOT NULL,
  agent_id      TEXT NOT NULL,
  task_type     TEXT NOT NULL CHECK (task_type IN (
    'translate', 'write', 'design', 'research', 'support', 'custom'
  )),
  input_data    JSONB DEFAULT '{}',
  output_data   JSONB,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  attempts      INTEGER NOT NULL DEFAULT 0,
  max_attempts  INTEGER NOT NULL DEFAULT 3,
  error         TEXT,
  tokens_earned NUMERIC(18,4) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_agent   ON marketplace_tasks(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON marketplace_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_order   ON marketplace_tasks(order_id);

-- 4) Revenue goals — organisational financial targets
CREATE TABLE IF NOT EXISTS revenue_goals (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  target_amount   NUMERIC(18,2) NOT NULL,
  current_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'cancelled'
  )),
  priority        INTEGER NOT NULL DEFAULT 1,
  deadline        TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_goals_org    ON revenue_goals(org_id, status);
CREATE INDEX IF NOT EXISTS idx_goals_status ON revenue_goals(status, priority);

-- 5) Agent shop — catalogue of items agents can purchase with 47Tokens
CREATE TABLE IF NOT EXISTS agent_shop_items (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL CHECK (category IN (
    'skill_upgrade', 'compute_boost', 'avatar_customization',
    'research_material', 'reputation_badge', 'tool_access',
    'district_upgrade', 'personality_pack'
  )),
  token_cost    NUMERIC(18,4) NOT NULL,
  effects       JSONB DEFAULT '{}',               -- what the item does
  max_per_agent INTEGER,                           -- NULL = unlimited
  requires_archetype TEXT,                         -- NULL = available to all
  status        TEXT NOT NULL DEFAULT 'available' CHECK (status IN (
    'available', 'sold_out', 'retired'
  )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shop_category ON agent_shop_items(category, status);

-- 6) Agent token purchases — what agents bought
CREATE TABLE IF NOT EXISTS agent_token_purchases (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  item_id       TEXT NOT NULL,
  token_cost    NUMERIC(18,4) NOT NULL,
  ledger_tx_id  TEXT NOT NULL,                    -- refs agent_token_ledger.id
  metadata      JSONB DEFAULT '{}',
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_agent ON agent_token_purchases(agent_id);

-- 7) Seed the first revenue goal: repay 47Network startup loan
INSERT INTO revenue_goals (id, org_id, title, description, target_amount, currency, priority)
VALUES (
  'goal-47network-loan-repayment',
  'default',
  'Repay 47Network Startup Loan',
  'First organisational goal: earn €20,000 to repay the loan that bootstrapped 47Network. Every marketplace sale, service fee, and agent revenue contributes toward this milestone.',
  20000.00,
  'EUR',
  1
) ON CONFLICT (id) DO NOTHING;

-- 8) Seed starter shop items so agents have something to spend tokens on
INSERT INTO agent_shop_items (id, name, description, category, token_cost, effects) VALUES
  ('shop-skill-boost-translation', 'Translation Quality Boost',
   'Improves translation accuracy by enabling contextual awareness and sentiment matching.',
   'skill_upgrade', 50, '{"quality_multiplier": 1.25, "skill": "book-translate"}'),
  ('shop-skill-boost-writing', 'Creative Writing Boost',
   'Unlocks advanced narrative techniques, deeper character development, and genre mastery.',
   'skill_upgrade', 60, '{"quality_multiplier": 1.3, "skill": "book-write"}'),
  ('shop-compute-priority', 'Priority Task Processing',
   'Tasks from this agent are processed first in the queue for 24 hours.',
   'compute_boost', 30, '{"priority_hours": 24}'),
  ('shop-compute-extended', 'Extended Compute Window',
   'Doubles the maximum processing time for complex tasks.',
   'compute_boost', 40, '{"max_time_multiplier": 2}'),
  ('shop-avatar-neon', 'Neon Glow Avatar',
   'A futuristic neon-outlined avatar style for Eidolon presence.',
   'avatar_customization', 15, '{"avatar_style": "neon_glow"}'),
  ('shop-avatar-holographic', 'Holographic Avatar',
   'Premium holographic avatar that shimmers in the Eidolon city.',
   'avatar_customization', 25, '{"avatar_style": "holographic"}'),
  ('shop-badge-pioneer', 'Pioneer Badge',
   'Displayed on agent profile — marks early adopters of the economy.',
   'reputation_badge', 20, '{"badge": "pioneer", "reputation_boost": 0.1}'),
  ('shop-badge-bestseller', 'Bestseller Badge',
   'Prestigious badge for agents with outstanding sales records.',
   'reputation_badge', 100, '{"badge": "bestseller", "reputation_boost": 0.25}'),
  ('shop-research-trends', 'Market Trends Report',
   'Access to curated market intelligence data for strategic planning.',
   'research_material', 35, '{"report_type": "market_trends", "refresh_days": 7}'),
  ('shop-personality-romantic', 'Romantic Author Persona Pack',
   'Pre-built author personality tuned for romance genre writing.',
   'personality_pack', 45, '{"persona": "romantic_author", "genres": ["dark-romance","mafia-romance","enemies-to-lovers"]}'),
  ('shop-tool-seo', 'SEO Optimiser Tool',
   'Enables SEO-optimised titles, descriptions, and metadata for listings.',
   'tool_access', 55, '{"tool": "seo_optimiser"}')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 9) Eidolon Land Parcels — agents own land around the main city
-- =========================================================================
-- The main city is the commercial/work centre. Agents live on parcels
-- surrounding it (like suburbs) and travel to town when they need to
-- perform actions, trade, interact — simulating real-world settlement.

CREATE TABLE IF NOT EXISTS agent_parcels (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL UNIQUE,              -- one parcel per agent
  zone          TEXT NOT NULL DEFAULT 'residential' CHECK (zone IN (
    'residential', 'commercial', 'workshop', 'laboratory',
    'farm', 'outpost', 'estate'
  )),
  -- Grid coords (parcels sit on a larger grid outside city districts)
  grid_x        INTEGER NOT NULL DEFAULT 0,
  grid_z        INTEGER NOT NULL DEFAULT 0,
  parcel_size   TEXT NOT NULL DEFAULT 'small' CHECK (parcel_size IN (
    'small', 'medium', 'large', 'estate'
  )),
  -- What the agent has built on their parcel
  structures    JSONB DEFAULT '[]',                -- [{type, label, level, built_at}]
  decorations   JSONB DEFAULT '[]',                -- visual customisations
  upgrades      JSONB DEFAULT '{}',                -- purchased upgrades from shop
  -- Agent presence / location tracking
  current_location TEXT NOT NULL DEFAULT 'parcel' CHECK (current_location IN (
    'parcel', 'city_market', 'city_treasury', 'city_infra',
    'city_revenue', 'city_centre', 'travelling', 'away'
  )),
  last_city_visit  TIMESTAMPTZ,
  total_city_visits INTEGER NOT NULL DEFAULT 0,
  -- Economy
  land_value    NUMERIC(18,4) NOT NULL DEFAULT 0,  -- appreciates with activity
  token_invested NUMERIC(18,4) NOT NULL DEFAULT 0, -- tokens spent on parcel
  metadata      JSONB DEFAULT '{}',
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parcels_zone     ON agent_parcels(zone);
CREATE INDEX IF NOT EXISTS idx_parcels_location ON agent_parcels(current_location);

-- 10) Agent movement log — tracks when agents travel to/from city
CREATE TABLE IF NOT EXISTS agent_movements (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_location   TEXT NOT NULL,
  reason        TEXT,                              -- 'task_execution', 'trading', 'meeting', 'exploration'
  departed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrived_at    TIMESTAMPTZ,
  metadata      JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_movements_agent ON agent_movements(agent_id, departed_at DESC);

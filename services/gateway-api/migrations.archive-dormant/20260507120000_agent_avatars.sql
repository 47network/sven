-- ============================================================================
-- Batch 33 — Agent Avatars & Identity (Animated Companion)
-- Personality evolution, appearance customization, mood tracking
-- ============================================================================

BEGIN;

-- ── agent_avatars ──────────────────────────────────────────────
-- Visual identity for each agent — style, mood, appearance config
CREATE TABLE IF NOT EXISTS agent_avatars (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  style         TEXT NOT NULL DEFAULT 'cyberpunk'
                CHECK (style IN ('cyberpunk','minimalist','retro','organic','glitch','neon','steampunk')),
  mood          TEXT NOT NULL DEFAULT 'neutral'
                CHECK (mood IN ('neutral','happy','focused','stressed','creative','tired','excited','contemplative')),
  form          TEXT NOT NULL DEFAULT 'orb'
                CHECK (form IN ('orb','humanoid','geometric','animal','abstract','mech')),
  color_primary   TEXT NOT NULL DEFAULT '#6366f1',
  color_secondary TEXT NOT NULL DEFAULT '#a855f7',
  glow_intensity  INTEGER NOT NULL DEFAULT 50 CHECK (glow_intensity >= 0 AND glow_intensity <= 100),
  accessories     JSONB NOT NULL DEFAULT '[]'::jsonb,
  animation_set   TEXT NOT NULL DEFAULT 'default',
  last_mood_change TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_agent_avatars_agent   ON agent_avatars (agent_id);
CREATE INDEX idx_agent_avatars_style          ON agent_avatars (style);
CREATE INDEX idx_agent_avatars_mood           ON agent_avatars (mood);

-- ── agent_traits ───────────────────────────────────────────────
-- Personality traits that evolve based on work history & interactions
CREATE TABLE IF NOT EXISTS agent_traits (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  trait_name    TEXT NOT NULL
                CHECK (trait_name IN (
                  'creativity','diligence','curiosity','sociability',
                  'precision','adaptability','leadership','empathy',
                  'resilience','humor','ambition','patience'
                )),
  score         INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  trend         TEXT NOT NULL DEFAULT 'stable'
                CHECK (trend IN ('rising','stable','declining')),
  last_event    TEXT,
  evolved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_traits_agent     ON agent_traits (agent_id);
CREATE INDEX idx_agent_traits_name      ON agent_traits (trait_name);
CREATE UNIQUE INDEX idx_agent_traits_unique ON agent_traits (agent_id, trait_name);

-- ── avatar_items ───────────────────────────────────────────────
-- Cosmetic items agents acquire with 47Tokens
CREATE TABLE IF NOT EXISTS avatar_items (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL
                CHECK (category IN ('hat','accessory','aura','pet','badge','background','frame','emote','material','blueprint','furniture','upgrade')),
  rarity        TEXT NOT NULL DEFAULT 'common'
                CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  price_tokens  INTEGER NOT NULL DEFAULT 10,
  description   TEXT,
  asset_url     TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_avatar_items_category  ON avatar_items (category);
CREATE INDEX idx_avatar_items_rarity    ON avatar_items (rarity);

-- ── agent_inventory ────────────────────────────────────────────
-- Items owned by agents
CREATE TABLE IF NOT EXISTS agent_inventory (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  item_id       TEXT NOT NULL REFERENCES avatar_items(id),
  equipped      BOOLEAN NOT NULL DEFAULT false,
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_inventory_agent  ON agent_inventory (agent_id);
CREATE INDEX idx_agent_inventory_item   ON agent_inventory (item_id);
CREATE UNIQUE INDEX idx_agent_inventory_unique ON agent_inventory (agent_id, item_id);

-- ── ALTER marketplace_tasks ────────────────────────────────────
ALTER TABLE marketplace_tasks DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'code','research','design','writing','support','testing','review',
    'translate','proofread','format','cover_design','genre_research',
    'misiuni_post','misiuni_verify','social_post','social_analytics',
    'xlvii_design','xlvii_catalog',
    'council_deliberate','council_vote',
    'memory_store','memory_retrieve','memory_compress',
    'fleet_deploy','fleet_benchmark','fleet_evict',
    'evolve_propose','evolve_experiment','evolve_rollback',
    'skill_catalog','skill_import','skill_audit',
    'video_create','video_render','video_preview',
    'avatar_customize','trait_evolve','mood_update'
  ));

-- ── default settings ───────────────────────────────────────────
INSERT INTO settings_global (key, value) VALUES
  ('avatar.default_style', 'cyberpunk'),
  ('avatar.mood_decay_hours', '24'),
  ('avatar.trait_evolution_rate', '0.05'),
  ('avatar.max_inventory_slots', '50'),
  ('avatar.glow_on_activity', 'true')
ON CONFLICT (key) DO NOTHING;

COMMIT;

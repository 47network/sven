-- Batch 144: Agent Blueprint System
-- Templates for composing complex agent architectures

CREATE TABLE IF NOT EXISTS system_blueprints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('agent','crew','service','platform','organisation')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','published','deprecated','archived')),
  version         TEXT NOT NULL DEFAULT '1.0.0',
  description     TEXT,
  component_count INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blueprint_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id    UUID NOT NULL REFERENCES system_blueprints(id) ON DELETE CASCADE,
  slot            TEXT NOT NULL CHECK (slot IN ('core','adapter','plugin','middleware','extension','driver')),
  component_name  TEXT NOT NULL,
  component_type  TEXT NOT NULL,
  config          JSONB NOT NULL DEFAULT '{}',
  required        BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blueprint_id, component_name)
);

CREATE TABLE IF NOT EXISTS blueprint_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id    UUID NOT NULL REFERENCES system_blueprints(id),
  instance_name   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','running','paused','failed','terminated')),
  overrides       JSONB NOT NULL DEFAULT '{}',
  health_score    REAL NOT NULL DEFAULT 100.0,
  started_at      TIMESTAMPTZ,
  stopped_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_agent ON system_blueprints(agent_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_status ON system_blueprints(status);
CREATE INDEX IF NOT EXISTS idx_bp_components_blueprint ON blueprint_components(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bp_components_slot ON blueprint_components(slot);
CREATE INDEX IF NOT EXISTS idx_bp_instances_blueprint ON blueprint_instances(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_bp_instances_status ON blueprint_instances(status);

-- Batch 136 — Agent Blue-Green Deployment
BEGIN;

CREATE TABLE IF NOT EXISTS blue_green_deployments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name    TEXT NOT NULL,
  environment     TEXT NOT NULL DEFAULT 'production',
  active_stage    TEXT NOT NULL DEFAULT 'blue' CHECK (active_stage IN ('blue','green')),
  status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','deploying','testing','switching','switched','rolling_back','failed')),
  blue_version    TEXT,
  green_version   TEXT,
  blue_health     JSONB NOT NULL DEFAULT '{}',
  green_health    JSONB NOT NULL DEFAULT '{}',
  traffic_split   JSONB NOT NULL DEFAULT '{"blue":100,"green":0}',
  switch_criteria JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_switch_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blue_green_switches (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id   UUID NOT NULL REFERENCES blue_green_deployments(id) ON DELETE CASCADE,
  from_stage      TEXT NOT NULL CHECK (from_stage IN ('blue','green')),
  to_stage        TEXT NOT NULL CHECK (to_stage IN ('blue','green')),
  reason          TEXT,
  initiated_by    UUID,
  health_before   JSONB NOT NULL DEFAULT '{}',
  health_after    JSONB NOT NULL DEFAULT '{}',
  duration_ms     INTEGER,
  success         BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS traffic_splits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id   UUID NOT NULL REFERENCES blue_green_deployments(id) ON DELETE CASCADE,
  blue_percent    INTEGER NOT NULL DEFAULT 100 CHECK (blue_percent >= 0 AND blue_percent <= 100),
  green_percent   INTEGER NOT NULL DEFAULT 0 CHECK (green_percent >= 0 AND green_percent <= 100),
  strategy        TEXT NOT NULL DEFAULT 'immediate' CHECK (strategy IN ('immediate','gradual','canary','random')),
  step_percent    INTEGER DEFAULT 10,
  step_interval   INTEGER DEFAULT 300,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bg_deployments_service ON blue_green_deployments(service_name);
CREATE INDEX IF NOT EXISTS idx_bg_deployments_status ON blue_green_deployments(status);
CREATE INDEX IF NOT EXISTS idx_bg_switches_deployment ON blue_green_switches(deployment_id);
CREATE INDEX IF NOT EXISTS idx_traffic_splits_deployment ON traffic_splits(deployment_id);
CREATE INDEX IF NOT EXISTS idx_bg_deployments_env ON blue_green_deployments(environment);
CREATE INDEX IF NOT EXISTS idx_bg_switches_created ON blue_green_switches(created_at);

COMMIT;

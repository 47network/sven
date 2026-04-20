-- Batch 48 — Agent Deployment Pipelines
-- Manages agent deployment lifecycle: build, test, stage, deploy, rollback
BEGIN;

CREATE TABLE IF NOT EXISTS deployment_pipelines (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  pipeline_name TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('draft','building','testing','staging','deploying','deployed','failed','rolled_back')),
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN ('manual','schedule','event','commit','api')),
  environment   TEXT NOT NULL CHECK (environment IN ('development','staging','production','canary')),
  config        JSONB NOT NULL DEFAULT '{}',
  version_tag   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_stages (
  id            TEXT PRIMARY KEY,
  pipeline_id   TEXT NOT NULL REFERENCES deployment_pipelines(id) ON DELETE CASCADE,
  stage_name    TEXT NOT NULL CHECK (stage_name IN ('build','test','lint','security_scan','staging','approval','deploy','health_check','rollback')),
  stage_order   INTEGER NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','running','passed','failed','skipped','cancelled')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INTEGER,
  logs          TEXT,
  artifacts     JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_artifacts (
  id            TEXT PRIMARY KEY,
  pipeline_id   TEXT NOT NULL REFERENCES deployment_pipelines(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('container_image','binary','config_bundle','skill_package','model_weights','documentation')),
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  size_bytes    BIGINT,
  checksum      TEXT,
  storage_url   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_rollbacks (
  id                TEXT PRIMARY KEY,
  pipeline_id       TEXT NOT NULL REFERENCES deployment_pipelines(id) ON DELETE CASCADE,
  from_version      TEXT NOT NULL,
  to_version        TEXT NOT NULL,
  reason            TEXT NOT NULL,
  rollback_type     TEXT NOT NULL CHECK (rollback_type IN ('automatic','manual','emergency')),
  status            TEXT NOT NULL CHECK (status IN ('pending','in_progress','completed','failed')),
  initiated_by      TEXT NOT NULL,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployment_environments (
  id                TEXT PRIMARY KEY,
  environment_name  TEXT NOT NULL UNIQUE,
  environment_type  TEXT NOT NULL CHECK (environment_type IN ('development','staging','production','canary')),
  config            JSONB NOT NULL DEFAULT '{}',
  health_status     TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','unhealthy','unknown')),
  current_version   TEXT,
  last_deployed_at  TIMESTAMPTZ,
  resource_limits   JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deploy_pipelines_agent ON deployment_pipelines(agent_id);
CREATE INDEX IF NOT EXISTS idx_deploy_pipelines_status ON deployment_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_deploy_pipelines_env ON deployment_pipelines(environment);
CREATE INDEX IF NOT EXISTS idx_deploy_pipelines_created ON deployment_pipelines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_stages_pipeline ON deployment_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deploy_stages_status ON deployment_stages(status);
CREATE INDEX IF NOT EXISTS idx_deploy_stages_order ON deployment_stages(pipeline_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_deploy_artifacts_pipeline ON deployment_artifacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deploy_artifacts_type ON deployment_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_deploy_artifacts_version ON deployment_artifacts(version);
CREATE INDEX IF NOT EXISTS idx_deploy_rollbacks_pipeline ON deployment_rollbacks(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deploy_rollbacks_status ON deployment_rollbacks(status);
CREATE INDEX IF NOT EXISTS idx_deploy_envs_type ON deployment_environments(environment_type);
CREATE INDEX IF NOT EXISTS idx_deploy_envs_health ON deployment_environments(health_status);
CREATE INDEX IF NOT EXISTS idx_deploy_envs_version ON deployment_environments(current_version);

COMMIT;

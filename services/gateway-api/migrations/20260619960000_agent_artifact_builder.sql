-- Batch 359: Artifact Builder
-- Builds, versions, and stores agent-produced artifacts (packages, binaries, documents)

CREATE TABLE IF NOT EXISTS agent_artifact_builder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  build_system VARCHAR(32) NOT NULL DEFAULT 'generic',
  output_format VARCHAR(32) NOT NULL DEFAULT 'archive',
  versioning_strategy VARCHAR(32) NOT NULL DEFAULT 'semver',
  storage_path TEXT NOT NULL DEFAULT '/artifacts',
  max_artifact_size_mb INTEGER NOT NULL DEFAULT 100,
  retention_count INTEGER NOT NULL DEFAULT 10,
  signing_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_artifact_builder_configs(id),
  agent_id UUID NOT NULL,
  artifact_name VARCHAR(255) NOT NULL,
  version VARCHAR(64) NOT NULL,
  format VARCHAR(32) NOT NULL DEFAULT 'archive',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum VARCHAR(128),
  storage_url TEXT,
  build_duration_ms BIGINT,
  status VARCHAR(32) NOT NULL DEFAULT 'building',
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_build_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES agent_artifacts(id),
  log_level VARCHAR(16) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  step_name VARCHAR(64),
  duration_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artifact_builder_configs_agent ON agent_artifact_builder_configs(agent_id);
CREATE INDEX idx_artifacts_config ON agent_artifacts(config_id);
CREATE INDEX idx_artifacts_agent ON agent_artifacts(agent_id);
CREATE INDEX idx_artifacts_name ON agent_artifacts(artifact_name);
CREATE INDEX idx_build_logs_artifact ON agent_build_logs(artifact_id);

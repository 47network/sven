-- Batch 308: Container Builder vertical
CREATE TABLE IF NOT EXISTS agent_container_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  base_image TEXT NOT NULL DEFAULT 'ubuntu:22.04',
  build_context TEXT NOT NULL DEFAULT '.',
  dockerfile_path TEXT NOT NULL DEFAULT 'Dockerfile',
  cache_enabled BOOLEAN NOT NULL DEFAULT true,
  multi_stage BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_container_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_container_configs(id),
  image_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','building','succeeded','failed','cancelled')),
  build_log TEXT,
  duration_ms INTEGER,
  image_size_bytes BIGINT,
  layer_count INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_container_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES agent_container_builds(id),
  layer_index INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT false,
  digest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_container_configs_agent ON agent_container_configs(agent_id);
CREATE INDEX idx_container_builds_config ON agent_container_builds(config_id);
CREATE INDEX idx_container_builds_status ON agent_container_builds(status);
CREATE INDEX idx_container_layers_build ON agent_container_layers(build_id);

-- Batch 281: Image Builder
CREATE TABLE IF NOT EXISTS agent_img_builder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  builder_type TEXT NOT NULL DEFAULT 'docker',
  base_images JSONB DEFAULT '[]',
  build_cache_enabled BOOLEAN DEFAULT true,
  max_concurrent INTEGER DEFAULT 2,
  registry_push_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_img_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_img_builder_configs(id),
  image_name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'latest',
  dockerfile_ref TEXT,
  build_args JSONB DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'queued',
  duration_seconds INTEGER,
  image_size_mb INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_img_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES agent_img_builds(id),
  layer_index INTEGER NOT NULL,
  command TEXT NOT NULL,
  size_mb INTEGER DEFAULT 0,
  cached BOOLEAN DEFAULT false,
  digest TEXT
);
CREATE INDEX idx_img_builder_configs_agent ON agent_img_builder_configs(agent_id);
CREATE INDEX idx_img_builds_config ON agent_img_builds(config_id);
CREATE INDEX idx_img_layers_build ON agent_img_layers(build_id);

-- Batch 344: SDK Generator
CREATE TABLE IF NOT EXISTS agent_sdk_generator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  target_languages JSONB DEFAULT '["typescript", "python"]',
  package_prefix TEXT DEFAULT 'sven-sdk',
  versioning_strategy TEXT DEFAULT 'semver',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_sdk_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_sdk_generator_configs(id),
  language TEXT NOT NULL,
  version TEXT NOT NULL,
  source_spec_id UUID,
  build_status TEXT DEFAULT 'pending',
  package_url TEXT,
  file_count INTEGER DEFAULT 0,
  built_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_sdk_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id UUID NOT NULL REFERENCES agent_sdk_builds(id),
  method_name TEXT NOT NULL,
  http_method TEXT,
  endpoint_path TEXT,
  parameters JSONB DEFAULT '[]',
  return_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sdk_builds_config ON agent_sdk_builds(config_id);
CREATE INDEX idx_sdk_methods_build ON agent_sdk_methods(build_id);

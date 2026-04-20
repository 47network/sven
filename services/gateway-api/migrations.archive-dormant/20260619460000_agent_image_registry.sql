-- Batch 309: Image Registry vertical
CREATE TABLE IF NOT EXISTS agent_image_reg_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  registry_url TEXT NOT NULL DEFAULT 'registry.sven.systems',
  auth_method TEXT NOT NULL DEFAULT 'token' CHECK (auth_method IN ('token','basic','oidc','none')),
  storage_backend TEXT NOT NULL DEFAULT 's3',
  retention_days INTEGER NOT NULL DEFAULT 90,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_registry_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_image_reg_configs(id),
  repo_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
  tag_count INTEGER NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  last_pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_registry_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES agent_registry_repos(id),
  tag_name TEXT NOT NULL,
  digest TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  architecture TEXT NOT NULL DEFAULT 'amd64',
  os TEXT NOT NULL DEFAULT 'linux',
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_image_reg_configs_agent ON agent_image_reg_configs(agent_id);
CREATE INDEX idx_registry_repos_config ON agent_registry_repos(config_id);
CREATE INDEX idx_registry_tags_repo ON agent_registry_tags(repo_id);

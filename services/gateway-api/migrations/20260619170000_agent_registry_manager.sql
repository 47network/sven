-- Batch 280: Registry Manager
CREATE TABLE IF NOT EXISTS agent_reg_mgr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  registry_type TEXT NOT NULL DEFAULT 'docker',
  registry_url TEXT NOT NULL,
  auth_ref TEXT,
  retention_days INTEGER DEFAULT 90,
  max_size_gb INTEGER DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_reg_repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_reg_mgr_configs(id),
  repo_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  tag_count INTEGER DEFAULT 0,
  total_size_mb INTEGER DEFAULT 0,
  last_push_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_reg_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES agent_reg_repositories(id),
  tag TEXT NOT NULL,
  digest TEXT NOT NULL,
  size_mb INTEGER DEFAULT 0,
  architecture TEXT DEFAULT 'amd64',
  pushed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX idx_reg_mgr_configs_agent ON agent_reg_mgr_configs(agent_id);
CREATE INDEX idx_reg_repos_config ON agent_reg_repositories(config_id);
CREATE INDEX idx_reg_tags_repo ON agent_reg_tags(repo_id);

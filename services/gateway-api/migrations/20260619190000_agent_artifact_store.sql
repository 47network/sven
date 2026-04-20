-- Batch 282: Artifact Store
CREATE TABLE IF NOT EXISTS agent_artifact_store_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  store_type TEXT NOT NULL DEFAULT 's3',
  bucket_name TEXT NOT NULL,
  endpoint_url TEXT,
  auth_ref TEXT,
  retention_policy JSONB DEFAULT '{}',
  max_size_gb INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_artifact_store_configs(id),
  artifact_key TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT DEFAULT 0,
  checksum TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_artifact_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES agent_artifacts(id),
  accessor_agent_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_artifact_store_configs_agent ON agent_artifact_store_configs(agent_id);
CREATE INDEX idx_artifacts_config ON agent_artifacts(config_id);
CREATE INDEX idx_artifact_access_log_artifact ON agent_artifact_access_log(artifact_id);

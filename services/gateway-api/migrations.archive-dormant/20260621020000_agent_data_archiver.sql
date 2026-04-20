CREATE TABLE IF NOT EXISTS agent_data_archiver_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  archive_targets JSONB NOT NULL DEFAULT '[]',
  retention_days INTEGER NOT NULL DEFAULT 365,
  compression TEXT NOT NULL DEFAULT 'gzip',
  storage_backend TEXT NOT NULL DEFAULT 's3',
  archive_schedule TEXT NOT NULL DEFAULT '0 2 * * *',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_data_archiver_configs_agent ON agent_data_archiver_configs(agent_id);
CREATE INDEX idx_agent_data_archiver_configs_enabled ON agent_data_archiver_configs(enabled);

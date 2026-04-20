CREATE TABLE IF NOT EXISTS agent_format_converter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  supported_formats JSONB NOT NULL DEFAULT '["json","csv","xml","yaml","parquet"]',
  max_file_size_mb INTEGER NOT NULL DEFAULT 500,
  preserve_metadata BOOLEAN NOT NULL DEFAULT true,
  encoding TEXT NOT NULL DEFAULT 'utf-8',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_conversion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_format_converter_configs(id),
  agent_id UUID NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  source_path TEXT,
  output_path TEXT,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  records_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_format_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_format_converter_configs(id),
  mapping_name TEXT NOT NULL,
  source_format TEXT NOT NULL,
  target_format TEXT NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  transform_options JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_agent ON agent_conversion_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_status ON agent_conversion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_format_mappings_config ON agent_format_mappings(config_id);

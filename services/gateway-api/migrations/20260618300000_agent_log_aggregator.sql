-- Agent Log Aggregator tables
CREATE TABLE IF NOT EXISTS agent_log_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('application','system','container','network','security','audit')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','error','draining')),
  endpoint TEXT,
  format VARCHAR(50) NOT NULL DEFAULT 'json' CHECK (format IN ('json','syslog','clf','csv','plaintext','logfmt')),
  retention_days INTEGER NOT NULL DEFAULT 30,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES agent_log_sources(id),
  level VARCHAR(20) NOT NULL CHECK (level IN ('trace','debug','info','warn','error','fatal')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_log_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pipeline_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','error','building')),
  stages JSONB NOT NULL DEFAULT '[]',
  throughput_eps NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_log_sources_agent ON agent_log_sources(agent_id);
CREATE INDEX idx_agent_log_entries_source ON agent_log_entries(source_id);
CREATE INDEX idx_agent_log_entries_level ON agent_log_entries(level);
CREATE INDEX idx_agent_log_pipelines_agent ON agent_log_pipelines(agent_id);

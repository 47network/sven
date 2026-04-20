CREATE TABLE IF NOT EXISTS agent_batch_processor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  default_batch_size INT DEFAULT 100,
  max_batch_size INT DEFAULT 10000,
  processing_mode VARCHAR(50) DEFAULT 'parallel' CHECK (processing_mode IN ('parallel','sequential','streaming','chunked')),
  error_handling VARCHAR(50) DEFAULT 'continue' CHECK (error_handling IN ('continue','stop','retry','skip')),
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_batch_processor_configs(id),
  name VARCHAR(255) NOT NULL,
  total_items INT NOT NULL,
  processed_items INT DEFAULT 0,
  failed_items INT DEFAULT 0,
  skipped_items INT DEFAULT 0,
  batch_size INT DEFAULT 100,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled','paused')),
  input_source TEXT,
  output_destination TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_summary JSONB DEFAULT '{}',
  progress_pct DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_job_id UUID NOT NULL REFERENCES agent_batch_jobs(id),
  item_index INT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','skipped')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_batch_proc_agent ON agent_batch_processor_configs(agent_id);
CREATE INDEX idx_batch_jobs_config ON agent_batch_jobs(config_id);
CREATE INDEX idx_batch_jobs_status ON agent_batch_jobs(status);
CREATE INDEX idx_batch_items_job ON agent_batch_items(batch_job_id);
CREATE INDEX idx_batch_items_status ON agent_batch_items(status);

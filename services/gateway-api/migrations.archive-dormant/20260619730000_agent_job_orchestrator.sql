CREATE TABLE IF NOT EXISTS agent_job_orchestrator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  concurrency_limit INT DEFAULT 20,
  priority_levels INT DEFAULT 5,
  dead_letter_enabled BOOLEAN DEFAULT true,
  retry_strategy VARCHAR(50) DEFAULT 'exponential' CHECK (retry_strategy IN ('exponential','linear','fixed','none')),
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_orchestrated_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_job_orchestrator_configs(id),
  name VARCHAR(255) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  priority INT DEFAULT 3 CHECK (priority BETWEEN 1 AND 10),
  payload JSONB DEFAULT '{}',
  dependencies UUID[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'queued' CHECK (status IN ('queued','waiting','running','completed','failed','dead_letter','cancelled')),
  assigned_worker VARCHAR(255),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB DEFAULT '{}',
  error_message TEXT,
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_job_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES agent_orchestrated_jobs(id),
  depends_on_job_id UUID NOT NULL REFERENCES agent_orchestrated_jobs(id),
  dependency_type VARCHAR(50) DEFAULT 'completion' CHECK (dependency_type IN ('completion','success','any')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_job_orch_agent ON agent_job_orchestrator_configs(agent_id);
CREATE INDEX idx_orch_jobs_config ON agent_orchestrated_jobs(config_id);
CREATE INDEX idx_orch_jobs_status ON agent_orchestrated_jobs(status);
CREATE INDEX idx_orch_jobs_priority ON agent_orchestrated_jobs(priority);
CREATE INDEX idx_job_deps_job ON agent_job_dependencies(job_id);

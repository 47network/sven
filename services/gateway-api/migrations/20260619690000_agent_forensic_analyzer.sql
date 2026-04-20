-- Batch 332: Forensic Analyzer - Digital forensics and incident investigation
CREATE TABLE IF NOT EXISTS agent_forensic_analyzer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  evidence_retention_days INTEGER NOT NULL DEFAULT 365,
  chain_of_custody BOOLEAN NOT NULL DEFAULT true,
  auto_snapshot BOOLEAN NOT NULL DEFAULT true,
  hash_algorithm VARCHAR(20) NOT NULL DEFAULT 'sha256',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_forensic_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_forensic_analyzer_configs(id),
  case_name VARCHAR(255) NOT NULL,
  case_type VARCHAR(50) NOT NULL DEFAULT 'incident',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  lead_investigator VARCHAR(255),
  summary TEXT,
  timeline JSONB DEFAULT '[]',
  findings JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_forensic_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES agent_forensic_cases(id),
  evidence_type VARCHAR(50) NOT NULL,
  source VARCHAR(255) NOT NULL,
  hash_value VARCHAR(128),
  file_size BIGINT,
  content_preview TEXT,
  chain_log JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_forensic_analyzer_configs_agent ON agent_forensic_analyzer_configs(agent_id);
CREATE INDEX idx_forensic_cases_config ON agent_forensic_cases(config_id);
CREATE INDEX idx_forensic_evidence_case ON agent_forensic_evidence(case_id);

-- Agent Forensic Analysis migration
-- Batch 169: post-incident forensic investigation and evidence collection

CREATE TABLE IF NOT EXISTS agent_forensic_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  incident_id UUID,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low','informational')),
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','investigating','evidence_collection','analysis','concluded','archived')),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  lead_investigator_id UUID,
  findings TEXT,
  root_cause TEXT,
  metadata JSONB DEFAULT '{}',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_forensic_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES agent_forensic_cases(id),
  evidence_type VARCHAR(50) NOT NULL CHECK (evidence_type IN ('log','metric','trace','screenshot','config_snapshot','memory_dump','network_capture','timeline')),
  source_system VARCHAR(255),
  content TEXT,
  content_hash VARCHAR(128),
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  collected_by UUID,
  chain_of_custody JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_forensic_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES agent_forensic_cases(id),
  event_time TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  source VARCHAR(255),
  impact_level VARCHAR(20) CHECK (impact_level IN ('none','minor','moderate','major','catastrophic')),
  evidence_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forensic_cases_status ON agent_forensic_cases(status);
CREATE INDEX idx_forensic_cases_severity ON agent_forensic_cases(severity);
CREATE INDEX idx_forensic_evidence_case ON agent_forensic_evidence(case_id);
CREATE INDEX idx_forensic_timelines_case ON agent_forensic_timelines(case_id);
CREATE INDEX idx_forensic_timelines_time ON agent_forensic_timelines(event_time);

-- Agent Patch Management migration
-- Batch 170: system and dependency patch lifecycle management

CREATE TABLE IF NOT EXISTS agent_patch_advisories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisory_id VARCHAR(100) UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('cve','npm','github','os_vendor','internal','custom')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','high','medium','low','none')),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  affected_component VARCHAR(255),
  affected_versions TEXT,
  fixed_version VARCHAR(100),
  patch_url TEXT,
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_patch_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisory_id UUID REFERENCES agent_patch_advisories(id),
  target_system VARCHAR(255) NOT NULL,
  target_version_before VARCHAR(100),
  target_version_after VARCHAR(100),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','testing','approved','deploying','deployed','failed','rolled_back')),
  deployed_by UUID,
  tested_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ,
  rollback_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_patch_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name VARCHAR(255) NOT NULL,
  total_advisories INTEGER DEFAULT 0,
  patched_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  compliance_score NUMERIC(5,2) DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  next_scan_at TIMESTAMPTZ,
  exceptions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patch_advisories_severity ON agent_patch_advisories(severity);
CREATE INDEX idx_patch_advisories_source ON agent_patch_advisories(source);
CREATE INDEX idx_patch_deployments_status ON agent_patch_deployments(status);
CREATE INDEX idx_patch_deployments_advisory ON agent_patch_deployments(advisory_id);
CREATE INDEX idx_patch_compliance_system ON agent_patch_compliance(system_name);

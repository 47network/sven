-- Agent Access Review migration
-- Batch 171: periodic access rights review and certification

CREATE TABLE IF NOT EXISTS agent_access_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('periodic','triggered','certification','audit','emergency')),
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','active','in_review','completed','cancelled')),
  scope_filter JSONB DEFAULT '{}',
  reviewer_agent_id UUID,
  total_entries INTEGER DEFAULT 0,
  reviewed_count INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  revoked_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES agent_access_campaigns(id),
  subject_agent_id UUID NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_name VARCHAR(255) NOT NULL,
  permission_level VARCHAR(50) NOT NULL CHECK (permission_level IN ('read','write','admin','execute','delete','full')),
  current_status VARCHAR(30) DEFAULT 'pending_review' CHECK (current_status IN ('pending_review','approved','revoked','flagged','exempted')),
  risk_score NUMERIC(5,2) DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name VARCHAR(255) NOT NULL,
  policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('rbac','abac','time_based','location_based','risk_based','custom')),
  rules JSONB NOT NULL DEFAULT '[]',
  enforcement_mode VARCHAR(30) DEFAULT 'audit' CHECK (enforcement_mode IN ('enforce','audit','disabled')),
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_campaigns_status ON agent_access_campaigns(status);
CREATE INDEX idx_access_entries_campaign ON agent_access_entries(campaign_id);
CREATE INDEX idx_access_entries_subject ON agent_access_entries(subject_agent_id);
CREATE INDEX idx_access_entries_status ON agent_access_entries(current_status);
CREATE INDEX idx_access_policies_type ON agent_access_policies(policy_type);

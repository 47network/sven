-- Batch 287: Release Gatekeeper
CREATE TABLE IF NOT EXISTS agent_release_gate_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  gates JSONB DEFAULT '["tests","security","review","staging"]',
  auto_promote BOOLEAN DEFAULT false,
  notification_channels JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_release_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_release_gate_configs(id),
  version TEXT NOT NULL,
  source_branch TEXT,
  commit_sha TEXT,
  state TEXT NOT NULL DEFAULT 'candidate',
  promoted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_release_gate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES agent_release_candidates(id),
  gate_name TEXT NOT NULL,
  passed BOOLEAN DEFAULT false,
  details JSONB DEFAULT '{}',
  evaluated_by TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_release_gate_configs_agent ON agent_release_gate_configs(agent_id);
CREATE INDEX idx_release_candidates_config ON agent_release_candidates(config_id);
CREATE INDEX idx_release_gate_results_candidate ON agent_release_gate_results(candidate_id);

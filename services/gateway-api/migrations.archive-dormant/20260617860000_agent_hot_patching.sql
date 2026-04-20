-- Batch 149: Agent Hot Patching
-- Live patching of agent behavior without restart

CREATE TABLE IF NOT EXISTS agent_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('prompt','config','skill','workflow','handler','filter')),
  operation TEXT NOT NULL CHECK (operation IN ('replace','append','prepend','delete','merge','wrap')),
  patch_data JSONB NOT NULL DEFAULT '{}',
  rollback_data JSONB,
  applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patch_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  agent_id UUID NOT NULL,
  patches UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','applied','rolled_back','failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patch_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id UUID NOT NULL REFERENCES agent_patches(id) ON DELETE CASCADE,
  chain_id UUID REFERENCES patch_chains(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','applied','rolled_back','failed','tested')),
  actor_agent_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_patches_agent ON agent_patches(agent_id);
CREATE INDEX idx_agent_patches_target ON agent_patches(target);
CREATE INDEX idx_agent_patches_applied ON agent_patches(applied);
CREATE INDEX idx_patch_chains_agent ON patch_chains(agent_id);
CREATE INDEX idx_patch_chains_status ON patch_chains(status);
CREATE INDEX idx_patch_audit_log_patch ON patch_audit_log(patch_id);

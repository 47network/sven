-- Batch 183: Agent Patch Manager
-- Tracks software patches, rollouts, compliance, and vulnerability remediation

CREATE TABLE IF NOT EXISTS agent_patch_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    policy_name TEXT NOT NULL,
    target_scope TEXT NOT NULL DEFAULT 'all',
    auto_approve BOOLEAN NOT NULL DEFAULT false,
    maintenance_window JSONB DEFAULT '{}',
    severity_filter TEXT[] DEFAULT ARRAY['critical','high','medium','low'],
    exclusions JSONB DEFAULT '[]',
    max_concurrent INTEGER NOT NULL DEFAULT 5,
    rollback_on_failure BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_patch_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES agent_patch_policies(id),
    patch_name TEXT NOT NULL,
    version TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','info')),
    cve_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    affected_systems INTEGER NOT NULL DEFAULT 0,
    patched_systems INTEGER NOT NULL DEFAULT 0,
    failed_systems INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rolling_out','completed','failed','rolled_back')),
    release_notes TEXT,
    metadata JSONB DEFAULT '{}',
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_patch_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES agent_patch_policies(id),
    target_host TEXT NOT NULL,
    current_version TEXT,
    required_version TEXT,
    compliance_status TEXT NOT NULL DEFAULT 'unknown' CHECK (compliance_status IN ('compliant','non_compliant','pending','exempt','unknown')),
    last_scan_at TIMESTAMPTZ,
    last_patched_at TIMESTAMPTZ,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_patch_policies_agent ON agent_patch_policies(agent_id);
CREATE INDEX idx_agent_patch_releases_policy ON agent_patch_releases(policy_id);
CREATE INDEX idx_agent_patch_releases_status ON agent_patch_releases(status);
CREATE INDEX idx_agent_patch_compliance_policy ON agent_patch_compliance(policy_id);
CREATE INDEX idx_agent_patch_compliance_status ON agent_patch_compliance(compliance_status);

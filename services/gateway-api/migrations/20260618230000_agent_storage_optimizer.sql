-- Batch 186: Agent Storage Optimizer
-- Analyzes storage usage, deduplication, tiering, lifecycle policies

CREATE TABLE IF NOT EXISTS agent_storage_volumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    volume_name TEXT NOT NULL,
    volume_type TEXT NOT NULL DEFAULT 'block' CHECK (volume_type IN ('block','object','file','archive','cache')),
    total_bytes BIGINT NOT NULL DEFAULT 0,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    available_bytes BIGINT NOT NULL DEFAULT 0,
    usage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('hot','warm','cold','archive','standard')),
    iops_limit INTEGER,
    throughput_mbps INTEGER,
    cost_per_gb_month NUMERIC(10,4),
    status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','offline','degraded','migrating','archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_storage_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volume_id UUID NOT NULL REFERENCES agent_storage_volumes(id),
    analysis_type TEXT NOT NULL DEFAULT 'usage' CHECK (analysis_type IN ('usage','dedup','tiering','lifecycle','cost','performance')),
    total_files BIGINT NOT NULL DEFAULT 0,
    duplicate_bytes BIGINT NOT NULL DEFAULT 0,
    reclaimable_bytes BIGINT NOT NULL DEFAULT 0,
    cold_data_bytes BIGINT NOT NULL DEFAULT 0,
    estimated_savings_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
    recommendations JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_storage_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES agent_storage_analyses(id),
    action_type TEXT NOT NULL DEFAULT 'archive' CHECK (action_type IN ('archive','delete','deduplicate','compress','tier_move','resize')),
    target_path TEXT,
    bytes_affected BIGINT NOT NULL DEFAULT 0,
    bytes_saved BIGINT NOT NULL DEFAULT 0,
    files_affected INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executing','completed','failed','rolled_back')),
    approved_by TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_storage_volumes_agent ON agent_storage_volumes(agent_id);
CREATE INDEX idx_agent_storage_volumes_status ON agent_storage_volumes(status);
CREATE INDEX idx_agent_storage_analyses_volume ON agent_storage_analyses(volume_id);
CREATE INDEX idx_agent_storage_actions_analysis ON agent_storage_actions(analysis_id);
CREATE INDEX idx_agent_storage_actions_status ON agent_storage_actions(status);

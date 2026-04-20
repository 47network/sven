-- Batch 348: Log Router — intelligent log routing, filtering, and aggregation
CREATE TABLE IF NOT EXISTS agent_log_router_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    router_name VARCHAR(255) NOT NULL,
    source_pattern VARCHAR(500) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    filter_rules JSONB DEFAULT '[]'::jsonb,
    sampling_rate NUMERIC(5,4) DEFAULT 1.0000,
    format_template TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_log_router_configs(id),
    pipeline_name VARCHAR(255) NOT NULL,
    stages JSONB DEFAULT '[]'::jsonb,
    throughput_limit INTEGER DEFAULT 10000,
    buffer_size INTEGER DEFAULT 1024,
    status VARCHAR(50) DEFAULT 'idle',
    last_processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES agent_log_pipelines(id),
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    source VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    routed_to VARCHAR(255),
    processed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_log_router_configs_agent ON agent_log_router_configs(agent_id);
CREATE INDEX idx_log_pipelines_config ON agent_log_pipelines(config_id);
CREATE INDEX idx_log_entries_pipeline ON agent_log_entries(pipeline_id);
CREATE INDEX idx_log_entries_level ON agent_log_entries(level);

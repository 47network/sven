-- Batch 349: Config Sync — distributed configuration synchronization
CREATE TABLE IF NOT EXISTS agent_config_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    sync_strategy VARCHAR(50) DEFAULT 'eventual',
    conflict_resolution VARCHAR(50) DEFAULT 'last_write_wins',
    poll_interval_ms INTEGER DEFAULT 30000,
    encryption_enabled BOOLEAN DEFAULT false,
    version_tracking BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_config_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_config_sync_configs(id),
    key VARCHAR(500) NOT NULL,
    value JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    checksum VARCHAR(64),
    source_node VARCHAR(255),
    is_encrypted BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(config_id, key)
);
CREATE TABLE IF NOT EXISTS agent_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES agent_config_entries(id),
    previous_value JSONB,
    new_value JSONB NOT NULL,
    changed_by VARCHAR(255),
    change_reason TEXT,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_config_sync_agent ON agent_config_sync_configs(agent_id);
CREATE INDEX idx_config_entries_config ON agent_config_entries(config_id);
CREATE INDEX idx_config_history_entry ON agent_config_history(entry_id);

-- Migration: agent_barcode_scanner_svc
CREATE TABLE IF NOT EXISTS agent_barcode_scanner_svc_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_barcode_scanner_svc_agent ON agent_barcode_scanner_svc_configs(agent_id);
CREATE INDEX idx_agent_barcode_scanner_svc_enabled ON agent_barcode_scanner_svc_configs(enabled);

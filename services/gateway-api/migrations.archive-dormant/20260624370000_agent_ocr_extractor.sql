-- Migration: agent_ocr_extractor
CREATE TABLE IF NOT EXISTS agent_ocr_extractor_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_ocr_extractor_agent ON agent_ocr_extractor_configs(agent_id);
CREATE INDEX idx_agent_ocr_extractor_enabled ON agent_ocr_extractor_configs(enabled);

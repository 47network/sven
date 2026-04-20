-- Migration: agent_pdf_renderer
CREATE TABLE IF NOT EXISTS agent_pdf_renderer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_pdf_renderer_agent ON agent_pdf_renderer_configs(agent_id);
CREATE INDEX idx_agent_pdf_renderer_enabled ON agent_pdf_renderer_configs(enabled);

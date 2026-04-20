-- Migration: agent_multipart_chunk_assembler
CREATE TABLE IF NOT EXISTS agent_multipart_chunk_assembler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_multipart_chunk_assembler_agent ON agent_multipart_chunk_assembler_configs(agent_id);
CREATE INDEX idx_agent_multipart_chunk_assembler_enabled ON agent_multipart_chunk_assembler_configs(enabled);

-- Migration: agent_fraud_audit_logger
CREATE TABLE IF NOT EXISTS agent_fraud_audit_logger_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_fraud_audit_logger_agent ON agent_fraud_audit_logger_configs(agent_id);
CREATE INDEX idx_agent_fraud_audit_logger_enabled ON agent_fraud_audit_logger_configs(enabled);

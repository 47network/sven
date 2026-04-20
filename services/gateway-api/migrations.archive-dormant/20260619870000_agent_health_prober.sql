-- Batch 350: Health Prober — endpoint health checking and availability monitoring
CREATE TABLE IF NOT EXISTS agent_health_prober_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    prober_name VARCHAR(255) NOT NULL,
    target_url VARCHAR(1000) NOT NULL,
    probe_type VARCHAR(50) DEFAULT 'http',
    interval_seconds INTEGER DEFAULT 30,
    timeout_ms INTEGER DEFAULT 5000,
    success_threshold INTEGER DEFAULT 1,
    failure_threshold INTEGER DEFAULT 3,
    expected_status INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_probe_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_health_prober_configs(id),
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    headers_snapshot JSONB,
    body_snapshot TEXT,
    probed_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_probe_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_health_prober_configs(id),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    message TEXT NOT NULL,
    consecutive_failures INTEGER DEFAULT 0,
    acknowledged BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_health_prober_agent ON agent_health_prober_configs(agent_id);
CREATE INDEX idx_probe_results_config ON agent_probe_results(config_id);
CREATE INDEX idx_probe_alerts_config ON agent_probe_alerts(config_id);
CREATE INDEX idx_probe_alerts_severity ON agent_probe_alerts(severity);

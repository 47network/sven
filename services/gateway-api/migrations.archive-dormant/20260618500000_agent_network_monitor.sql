-- Batch 213: Network Monitor
-- Agent-managed network monitoring and alerting

CREATE TABLE IF NOT EXISTS agent_network_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    monitor_name VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('host','service','port','endpoint','network','container')),
    target_address TEXT NOT NULL,
    protocol VARCHAR(20) NOT NULL DEFAULT 'icmp' CHECK (protocol IN ('icmp','tcp','udp','http','https','grpc','dns','snmp')),
    check_interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_seconds INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','alerting','maintenance')),
    last_check_at TIMESTAMPTZ,
    last_status VARCHAR(20) CHECK (last_status IN ('up','down','degraded','timeout','unknown')),
    uptime_percent NUMERIC(5,2),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    alert_threshold INTEGER NOT NULL DEFAULT 3,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES agent_network_monitors(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('down','degraded','latency_high','packet_loss','threshold_breach','recovery','flapping')),
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical','emergency')),
    message TEXT NOT NULL,
    response_time_ms NUMERIC(10,2),
    packet_loss_percent NUMERIC(5,2),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID NOT NULL REFERENCES agent_network_monitors(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('latency','packet_loss','throughput','jitter','availability','error_rate','connection_count')),
    value NUMERIC(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_network_monitors_agent ON agent_network_monitors(agent_id);
CREATE INDEX idx_network_monitors_status ON agent_network_monitors(status);
CREATE INDEX idx_network_alerts_monitor ON agent_network_alerts(monitor_id);
CREATE INDEX idx_network_alerts_type ON agent_network_alerts(alert_type);
CREATE INDEX idx_network_metrics_monitor ON agent_network_metrics(monitor_id);
CREATE INDEX idx_network_metrics_type ON agent_network_metrics(metric_type);
CREATE INDEX idx_network_metrics_recorded ON agent_network_metrics(recorded_at);

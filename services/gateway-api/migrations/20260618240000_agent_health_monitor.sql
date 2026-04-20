-- Batch 187: Agent Health Monitor
-- Service health checks, uptime tracking, incident detection, SLA monitoring

CREATE TABLE IF NOT EXISTS agent_health_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    endpoint_name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    check_type TEXT NOT NULL DEFAULT 'http' CHECK (check_type IN ('http','tcp','dns','icmp','grpc','websocket','custom')),
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    timeout_seconds INTEGER NOT NULL DEFAULT 10,
    expected_status INTEGER DEFAULT 200,
    expected_body TEXT,
    headers JSONB DEFAULT '{}',
    current_status TEXT NOT NULL DEFAULT 'unknown' CHECK (current_status IN ('healthy','degraded','unhealthy','unknown','maintenance')),
    uptime_percent NUMERIC(6,3) NOT NULL DEFAULT 100.000,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_check_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled','archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES agent_health_endpoints(id),
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER,
    result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success','failure','timeout','error','degraded')),
    error_message TEXT,
    response_body TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_health_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES agent_health_endpoints(id),
    incident_type TEXT NOT NULL DEFAULT 'outage' CHECK (incident_type IN ('outage','degradation','latency_spike','error_rate','certificate','dns_failure')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','info')),
    title TEXT NOT NULL,
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    root_cause TEXT,
    resolution TEXT,
    affected_services TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','identified','monitoring','resolved')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_health_endpoints_agent ON agent_health_endpoints(agent_id);
CREATE INDEX idx_agent_health_endpoints_status ON agent_health_endpoints(current_status);
CREATE INDEX idx_agent_health_checks_endpoint ON agent_health_checks(endpoint_id);
CREATE INDEX idx_agent_health_checks_result ON agent_health_checks(result);
CREATE INDEX idx_agent_health_incidents_endpoint ON agent_health_incidents(endpoint_id);
CREATE INDEX idx_agent_health_incidents_status ON agent_health_incidents(status);
CREATE INDEX idx_agent_health_incidents_severity ON agent_health_incidents(severity);

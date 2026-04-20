-- Batch 198: Service Registry
-- Tracks registered microservices, their health, and discovery metadata

CREATE TABLE IF NOT EXISTS agent_service_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    service_name TEXT NOT NULL,
    service_version TEXT NOT NULL DEFAULT '1.0.0',
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    protocol TEXT NOT NULL DEFAULT 'http' CHECK (protocol IN ('http','https','grpc','tcp','udp','ws','wss')),
    health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy','unhealthy','degraded','unknown','draining')),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ,
    deregistered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_service_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES agent_service_instances(id),
    check_type TEXT NOT NULL DEFAULT 'http' CHECK (check_type IN ('http','tcp','grpc','script','ttl')),
    endpoint TEXT,
    interval_seconds INTEGER NOT NULL DEFAULT 30,
    timeout_seconds INTEGER NOT NULL DEFAULT 5,
    healthy_threshold INTEGER NOT NULL DEFAULT 3,
    unhealthy_threshold INTEGER NOT NULL DEFAULT 3,
    last_check_at TIMESTAMPTZ,
    last_status TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_service_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES agent_service_instances(id),
    path TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
    description TEXT,
    rate_limit INTEGER,
    auth_required BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_instances_agent ON agent_service_instances(agent_id);
CREATE INDEX idx_service_instances_name ON agent_service_instances(service_name);
CREATE INDEX idx_service_instances_health ON agent_service_instances(health_status);
CREATE INDEX idx_service_health_instance ON agent_service_health_checks(instance_id);
CREATE INDEX idx_service_endpoints_instance ON agent_service_endpoints(instance_id);

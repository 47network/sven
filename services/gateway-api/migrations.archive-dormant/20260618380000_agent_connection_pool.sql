-- Batch 201: Connection Pool
-- Manages database/service connection pools, limits, and health

CREATE TABLE IF NOT EXISTS agent_connection_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    pool_name TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('postgresql','mysql','redis','mongodb','http','grpc','amqp','nats')),
    target_host TEXT NOT NULL,
    target_port INTEGER NOT NULL,
    min_connections INTEGER NOT NULL DEFAULT 2,
    max_connections INTEGER NOT NULL DEFAULT 20,
    idle_timeout_seconds INTEGER NOT NULL DEFAULT 300,
    connection_timeout_ms INTEGER NOT NULL DEFAULT 5000,
    active_connections INTEGER NOT NULL DEFAULT 0,
    idle_connections INTEGER NOT NULL DEFAULT 0,
    total_created BIGINT NOT NULL DEFAULT 0,
    total_destroyed BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draining','paused','error','closed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_connection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES agent_connection_pools(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('created','destroyed','acquired','released','timeout','error','health_check')),
    connection_id TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_connection_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES agent_connection_pools(id),
    avg_wait_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_usage_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    utilization_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    timeouts_count INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conn_pools_agent ON agent_connection_pools(agent_id);
CREATE INDEX idx_conn_pools_status ON agent_connection_pools(status);
CREATE INDEX idx_conn_events_pool ON agent_connection_events(pool_id);
CREATE INDEX idx_conn_events_time ON agent_connection_events(occurred_at);
CREATE INDEX idx_conn_metrics_pool ON agent_connection_metrics(pool_id);

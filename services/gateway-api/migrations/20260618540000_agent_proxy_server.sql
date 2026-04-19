-- Batch 217: Proxy Server
-- Agent-managed proxy routing, caching, and access control

CREATE TABLE IF NOT EXISTS agent_proxy_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    endpoint_name VARCHAR(255) NOT NULL,
    proxy_type VARCHAR(30) NOT NULL CHECK (proxy_type IN ('forward','reverse','transparent','socks5','http_connect','api_gateway','cdn')),
    listen_address TEXT NOT NULL,
    listen_port INTEGER NOT NULL,
    upstream_url TEXT NOT NULL,
    tls_enabled BOOLEAN NOT NULL DEFAULT false,
    auth_required BOOLEAN NOT NULL DEFAULT false,
    auth_method VARCHAR(30) CHECK (auth_method IN ('basic','bearer','api_key','mtls','oauth2','none')),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','draining','error','maintenance')),
    max_connections INTEGER NOT NULL DEFAULT 1000,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    cache_enabled BOOLEAN NOT NULL DEFAULT false,
    cache_ttl_seconds INTEGER DEFAULT 300,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_proxy_access_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES agent_proxy_endpoints(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('allow','deny','rate_limit','rewrite','header_inject','cors','cache_override','redirect')),
    match_type VARCHAR(30) NOT NULL CHECK (match_type IN ('path','header','query','method','ip','user_agent','cookie','body')),
    match_pattern TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 100,
    enabled BOOLEAN NOT NULL DEFAULT true,
    hit_count BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_proxy_traffic_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES agent_proxy_endpoints(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    response_time_ms NUMERIC(10,2),
    client_ip INET,
    upstream_status INTEGER,
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    rule_matched UUID,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_endpoints_agent ON agent_proxy_endpoints(agent_id);
CREATE INDEX idx_proxy_endpoints_type ON agent_proxy_endpoints(proxy_type);
CREATE INDEX idx_proxy_access_rules_endpoint ON agent_proxy_access_rules(endpoint_id);
CREATE INDEX idx_proxy_access_rules_type ON agent_proxy_access_rules(rule_type);
CREATE INDEX idx_proxy_traffic_logs_endpoint ON agent_proxy_traffic_logs(endpoint_id);
CREATE INDEX idx_proxy_traffic_logs_status ON agent_proxy_traffic_logs(status_code);
CREATE INDEX idx_proxy_traffic_logs_logged ON agent_proxy_traffic_logs(logged_at);

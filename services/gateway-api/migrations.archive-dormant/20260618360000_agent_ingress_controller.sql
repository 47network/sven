-- Batch 199: Ingress Controller
-- Manages external traffic routing, TLS termination, and path-based routing

CREATE TABLE IF NOT EXISTS agent_ingress_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    rule_name TEXT NOT NULL,
    host_pattern TEXT NOT NULL,
    path_prefix TEXT NOT NULL DEFAULT '/',
    target_service TEXT NOT NULL,
    target_port INTEGER NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    tls_enabled BOOLEAN NOT NULL DEFAULT true,
    tls_cert_id UUID,
    rate_limit_rps INTEGER,
    cors_enabled BOOLEAN NOT NULL DEFAULT false,
    cors_origins TEXT[] DEFAULT '{}',
    auth_mode TEXT NOT NULL DEFAULT 'none' CHECK (auth_mode IN ('none','basic','bearer','oauth2','mtls','api_key')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_ingress_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    domain TEXT NOT NULL,
    cert_type TEXT NOT NULL DEFAULT 'lets_encrypt' CHECK (cert_type IN ('lets_encrypt','self_signed','custom','managed')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','revoked','failed')),
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_ingress_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES agent_ingress_rules(id),
    client_ip TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    bytes_sent BIGINT NOT NULL DEFAULT 0,
    user_agent TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingress_rules_agent ON agent_ingress_rules(agent_id);
CREATE INDEX idx_ingress_rules_host ON agent_ingress_rules(host_pattern);
CREATE INDEX idx_ingress_certs_agent ON agent_ingress_certificates(agent_id);
CREATE INDEX idx_ingress_certs_domain ON agent_ingress_certificates(domain);
CREATE INDEX idx_ingress_logs_rule ON agent_ingress_access_logs(rule_id);
CREATE INDEX idx_ingress_logs_time ON agent_ingress_access_logs(logged_at);

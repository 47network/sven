-- Migration: Federation + Homeserver Model tables (Batch 5: 5.1-5.8)
-- Foundation for Sven-to-Sven communication, instance identity, and data sovereignty.

BEGIN;

-- ============================================================
-- 5.1 Instance Identity: Ed25519 keypair storage
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_instance_identity (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    public_key          TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    fingerprint         TEXT NOT NULL,
    algorithm           TEXT NOT NULL DEFAULT 'ed25519',
    key_version         INTEGER NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at          TIMESTAMPTZ,
    UNIQUE (organization_id, fingerprint)
);
COMMENT ON TABLE federation_instance_identity IS 'Ed25519 keypair for signing federated messages per instance';
CREATE INDEX idx_fed_identity_org ON federation_instance_identity (organization_id, is_active);

-- ============================================================
-- 5.2 Instance Discovery: Known federation peers
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_peers (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    instance_id         TEXT NOT NULL,
    instance_name       TEXT NOT NULL,
    public_key          TEXT,
    fingerprint         TEXT,
    address             TEXT NOT NULL,
    nats_leaf_url       TEXT,
    capabilities        JSONB NOT NULL DEFAULT '[]',
    trust_level         TEXT NOT NULL DEFAULT 'untrusted'
                        CHECK (trust_level IN ('untrusted', 'verified', 'trusted', 'blocked')),
    status              TEXT NOT NULL DEFAULT 'discovered'
                        CHECK (status IN ('discovered', 'handshake', 'active', 'degraded', 'offline', 'blocked')),
    last_seen_at        TIMESTAMPTZ,
    last_handshake_at   TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, instance_id)
);
COMMENT ON TABLE federation_peers IS 'Known remote Sven instances for federation';
CREATE INDEX idx_fed_peers_org_status ON federation_peers (organization_id, status, trust_level);
CREATE INDEX idx_fed_peers_address ON federation_peers (address);

-- ============================================================
-- 5.3 Homeserver Model: Client connection registry
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_homeserver_connections (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    client_type         TEXT NOT NULL
                        CHECK (client_type IN ('flutter_mobile', 'tauri_desktop', 'web', 'cli', 'api')),
    client_version      TEXT,
    device_id           TEXT,
    connection_token    TEXT NOT NULL,
    last_active_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'idle', 'disconnected')),
    capabilities        JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE federation_homeserver_connections IS 'Client connections to this Sven homeserver instance';
CREATE INDEX idx_fed_hs_conn_org_user ON federation_homeserver_connections (organization_id, user_id, status);
CREATE INDEX idx_fed_hs_conn_token ON federation_homeserver_connections (connection_token);

-- ============================================================
-- 5.4 Cross-Instance Community: Federated topics
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_community_topics (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    topic_name          TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    direction           TEXT NOT NULL DEFAULT 'bidirectional'
                        CHECK (direction IN ('publish', 'subscribe', 'bidirectional')),
    peer_id             TEXT REFERENCES federation_peers(id) ON DELETE CASCADE,
    nats_subject        TEXT NOT NULL,
    message_count       BIGINT NOT NULL DEFAULT 0,
    last_message_at     TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, topic_name, peer_id)
);
COMMENT ON TABLE federation_community_topics IS 'Federated community topics shared across instances';
CREATE INDEX idx_fed_topics_org ON federation_community_topics (organization_id, is_active);
CREATE INDEX idx_fed_topics_peer ON federation_community_topics (peer_id, is_active);

-- ============================================================
-- 5.5 Cross-Instance Agent Delegation
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_agent_delegations (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    local_agent_id      TEXT NOT NULL,
    remote_peer_id      TEXT NOT NULL REFERENCES federation_peers(id) ON DELETE CASCADE,
    remote_agent_id     TEXT,
    task_description    TEXT NOT NULL,
    task_payload        JSONB NOT NULL DEFAULT '{}',
    response_payload    JSONB,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'accepted', 'in_progress', 'completed', 'failed', 'rejected', 'timeout')),
    timeout_ms          INTEGER NOT NULL DEFAULT 30000,
    signed_request      TEXT,
    signed_response     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE federation_agent_delegations IS 'Cross-instance agent consultation and delegation requests';
CREATE INDEX idx_fed_delegations_org ON federation_agent_delegations (organization_id, status, created_at DESC);
CREATE INDEX idx_fed_delegations_peer ON federation_agent_delegations (remote_peer_id, status);

-- ============================================================
-- 5.6 Community Consent Toggles (per-user)
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_consent (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    consent_level       TEXT NOT NULL DEFAULT 'off'
                        CHECK (consent_level IN ('off', 'read_only', 'contribute')),
    federated_topics    JSONB NOT NULL DEFAULT '[]',
    share_agent_data    BOOLEAN NOT NULL DEFAULT FALSE,
    share_memory_data   BOOLEAN NOT NULL DEFAULT FALSE,
    consent_given_at    TIMESTAMPTZ,
    consent_ip          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);
COMMENT ON TABLE federation_consent IS 'Per-user federation consent (default OFF, GDPR Article 7)';
CREATE INDEX idx_fed_consent_org_user ON federation_consent (organization_id, user_id);
CREATE INDEX idx_fed_consent_level ON federation_consent (organization_id, consent_level);

-- ============================================================
-- 5.7 Data Sovereignty Controls (per-org)
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_data_sovereignty (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL UNIQUE,
    federation_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_regions     JSONB NOT NULL DEFAULT '[]',
    blocked_peers       JSONB NOT NULL DEFAULT '[]',
    data_retention_days INTEGER NOT NULL DEFAULT 90,
    max_federation_peers INTEGER NOT NULL DEFAULT 10,
    require_mutual_tls  BOOLEAN NOT NULL DEFAULT TRUE,
    require_peer_verification BOOLEAN NOT NULL DEFAULT TRUE,
    export_policy       TEXT NOT NULL DEFAULT 'none'
                        CHECK (export_policy IN ('none', 'anonymized', 'pseudonymized', 'full')),
    audit_federation_traffic BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE federation_data_sovereignty IS 'Organization-level data sovereignty and federation scope controls';
CREATE INDEX idx_fed_sovereignty_org ON federation_data_sovereignty (organization_id, federation_enabled);

-- ============================================================
-- 5.8 Federation Peer Health Records
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_peer_health (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    peer_id             TEXT NOT NULL REFERENCES federation_peers(id) ON DELETE CASCADE,
    check_type          TEXT NOT NULL DEFAULT 'ping'
                        CHECK (check_type IN ('ping', 'handshake', 'capability', 'full')),
    status              TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unreachable', 'unknown')),
    response_time_ms    INTEGER,
    error_message       TEXT,
    peer_version        TEXT,
    peer_capabilities   JSONB DEFAULT '[]',
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE federation_peer_health IS 'Health check records for federation peers';
CREATE INDEX idx_fed_health_peer ON federation_peer_health (peer_id, checked_at DESC);
CREATE INDEX idx_fed_health_org ON federation_peer_health (organization_id, status, checked_at DESC);

-- ============================================================
-- Federation audit log (compliance: SOC 2, GDPR)
-- ============================================================
CREATE TABLE IF NOT EXISTS federation_audit_log (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    peer_id             TEXT,
    user_id             TEXT,
    action              TEXT NOT NULL,
    details             JSONB NOT NULL DEFAULT '{}',
    source_ip           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE federation_audit_log IS 'Immutable audit log for all federation events (SOC 2 / GDPR)';
CREATE INDEX idx_fed_audit_org ON federation_audit_log (organization_id, event_type, created_at DESC);
CREATE INDEX idx_fed_audit_peer ON federation_audit_log (peer_id, created_at DESC);

COMMIT;

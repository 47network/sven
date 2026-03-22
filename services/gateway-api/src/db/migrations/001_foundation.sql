-- Sven v0.1.0 – Full Database Schema
-- Migration 001: Foundation tables
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION
    WHEN undefined_file THEN
        CREATE EXTENSION IF NOT EXISTS "pgvector";
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.2 Core Tables                                           ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    password_hash   TEXT NOT NULL,
    totp_secret_enc TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identities (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,
    channel_user_id TEXT NOT NULL,
    display_name    TEXT,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (channel, channel_user_id)
);
CREATE INDEX idx_identities_user ON identities(user_id);

CREATE TABLE chats (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('dm', 'group', 'hq')),
    channel         TEXT,
    channel_chat_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_members (
    id        TEXT PRIMARY KEY,
    chat_id   TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chat_id, user_id)
);
CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);

CREATE TABLE messages (
    id                 TEXT PRIMARY KEY,
    chat_id            TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_user_id     TEXT REFERENCES users(id),
    sender_identity_id TEXT REFERENCES identities(id),
    role               TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content_type       TEXT NOT NULL CHECK (content_type IN ('text', 'file', 'audio', 'blocks')),
    text               TEXT,
    blocks             JSONB,
    channel_message_id TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_chat ON messages(chat_id, created_at);

CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_totp', 'revoked', 'refresh')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.3 Policy / Tools / Audit                                ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE tools (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name               TEXT UNIQUE NOT NULL,
    display_name       TEXT NOT NULL DEFAULT '',
    category           TEXT NOT NULL DEFAULT 'general',
    description        TEXT NOT NULL DEFAULT '',
    version            TEXT NOT NULL DEFAULT '0.0.1',
    execution_mode     TEXT NOT NULL DEFAULT 'container' CHECK (execution_mode IN ('in_process', 'container', 'gvisor', 'firecracker')),
    inputs_schema      JSONB NOT NULL DEFAULT '{}',
    outputs_schema     JSONB NOT NULL DEFAULT '{}',
    permissions_required TEXT[] NOT NULL DEFAULT '{}',
    resource_limits    JSONB NOT NULL DEFAULT '{"timeout_ms": 30000, "cpu_limit": "0.5", "memory_limit": "256m", "max_bytes": 10485760, "max_concurrency": 1}',
    timeout_seconds    INT NOT NULL DEFAULT 30,
    timeout_ms         INT NOT NULL DEFAULT 30000,
    max_memory_mb      INT NOT NULL DEFAULT 256,
    max_cpu_shares     INT NOT NULL DEFAULT 512,
    max_bytes          BIGINT NOT NULL DEFAULT 10485760,
    max_concurrency    INT NOT NULL DEFAULT 1,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    is_first_party     BOOLEAN NOT NULL DEFAULT FALSE,
    trust_level        TEXT NOT NULL DEFAULT 'quarantined' CHECK (trust_level IN ('trusted', 'quarantined', 'blocked')),
    status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deprecated')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id           TEXT PRIMARY KEY,
    scope        TEXT NOT NULL,
    effect       TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    target_type  TEXT NOT NULL CHECK (target_type IN ('user', 'chat', 'global')),
    target_id    TEXT,
    conditions   JSONB,
    created_by   TEXT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_permissions_scope ON permissions(scope);
CREATE INDEX idx_permissions_target ON permissions(target_type, target_id);

CREATE TABLE approvals (
    id                TEXT PRIMARY KEY,
    chat_id           TEXT NOT NULL REFERENCES chats(id),
    tool_name         TEXT NOT NULL,
    scope             TEXT NOT NULL,
    requester_user_id TEXT NOT NULL REFERENCES users(id),
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    quorum_required   INT NOT NULL DEFAULT 1,
    votes_approve     INT NOT NULL DEFAULT 0,
    votes_deny        INT NOT NULL DEFAULT 0,
    expires_at        TIMESTAMPTZ NOT NULL,
    details           JSONB NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ
);
CREATE INDEX idx_approvals_status ON approvals(status);

CREATE TABLE approval_votes (
    id              TEXT PRIMARY KEY,
    approval_id     TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    voter_user_id   TEXT NOT NULL REFERENCES users(id),
    vote            TEXT NOT NULL CHECK (vote IN ('approve', 'deny')),
    voted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (approval_id, voter_user_id)
);

CREATE TABLE tool_runs (
    id                   TEXT PRIMARY KEY,
    tool_name            TEXT NOT NULL,
    chat_id              TEXT NOT NULL REFERENCES chats(id),
    user_id              TEXT NOT NULL REFERENCES users(id),
    approval_id          TEXT REFERENCES approvals(id),
    status               TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'timeout', 'denied')),
    inputs               JSONB NOT NULL DEFAULT '{}',
    outputs              JSONB,
    tool_logs            JSONB,
    error                TEXT,
    prev_hash            TEXT NOT NULL DEFAULT '',
    run_hash             TEXT NOT NULL DEFAULT '',
    canonical_io_sha256  TEXT NOT NULL DEFAULT '',
    duration_ms          INT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);
CREATE INDEX idx_tool_runs_chat ON tool_runs(chat_id, created_at);
CREATE INDEX idx_tool_runs_status ON tool_runs(status);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.4 Memory / Identity Docs                                ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE sven_identity_docs (
    id         TEXT PRIMARY KEY,
    scope      TEXT NOT NULL CHECK (scope IN ('global', 'chat')),
    chat_id    TEXT REFERENCES chats(id),
    content    TEXT NOT NULL DEFAULT '',
    version    INT NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_persona (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    persona    TEXT NOT NULL DEFAULT '',
    updated_by TEXT NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memories (
    id         TEXT PRIMARY KEY,
    user_id    TEXT REFERENCES users(id),
    chat_id    TEXT REFERENCES chats(id),
    visibility TEXT NOT NULL CHECK (visibility IN ('user_private', 'chat_shared', 'global')),
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    embedding  vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_chat ON memories(chat_id);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.5 Canvas / Artifacts                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE canvas_events (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL REFERENCES chats(id),
    message_id TEXT NOT NULL REFERENCES messages(id),
    blocks     JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_canvas_chat ON canvas_events(chat_id, created_at);

CREATE TABLE artifacts (
    id               TEXT PRIMARY KEY,
    chat_id          TEXT NOT NULL REFERENCES chats(id),
    message_id       TEXT REFERENCES messages(id),
    tool_run_id      TEXT REFERENCES tool_runs(id),
    name             TEXT NOT NULL,
    mime_type        TEXT NOT NULL,
    size_bytes       BIGINT NOT NULL DEFAULT 0,
    storage_path     TEXT NOT NULL,
    is_private       BOOLEAN NOT NULL DEFAULT FALSE,
    enc_alg          TEXT,
    enc_kid          TEXT,
    ciphertext_sha256 TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_artifacts_chat ON artifacts(chat_id);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.6 Registry                                              ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE registry_sources (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK (type IN ('public', 'private', 'local')),
    url        TEXT,
    path       TEXT,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registry_publishers (
    id         TEXT PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    trusted    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skills_catalog (
    id          TEXT PRIMARY KEY,
    source_id   TEXT NOT NULL REFERENCES registry_sources(id),
    publisher_id TEXT REFERENCES registry_publishers(id),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     TEXT NOT NULL,
    format      TEXT NOT NULL CHECK (format IN ('openclaw', 'oci')),
    manifest    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skills_installed (
    id               TEXT PRIMARY KEY,
    catalog_entry_id TEXT NOT NULL REFERENCES skills_catalog(id),
    tool_id          TEXT NOT NULL REFERENCES tools(id),
    trust_level      TEXT NOT NULL DEFAULT 'quarantined' CHECK (trust_level IN ('trusted', 'quarantined', 'blocked')),
    installed_by     TEXT NOT NULL REFERENCES users(id),
    installed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_signatures (
    id          TEXT PRIMARY KEY,
    skill_id    TEXT NOT NULL REFERENCES skills_installed(id),
    signer      TEXT NOT NULL,
    signature   TEXT NOT NULL,
    algorithm   TEXT NOT NULL DEFAULT 'cosign',
    verified    BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_quarantine_reports (
    id               TEXT PRIMARY KEY,
    skill_id         TEXT NOT NULL REFERENCES skills_installed(id),
    static_checks    JSONB NOT NULL DEFAULT '{}',
    sbom             JSONB,
    vuln_scan        JSONB,
    risk_score       REAL,
    recommendation   TEXT CHECK (recommendation IN ('promote', 'block', 'review')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.7 Settings / Performance / Buddy                        ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE settings_global (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.8 Encryption                                            ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE user_keys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wrapped_dek   TEXT NOT NULL,
    algorithm     TEXT NOT NULL DEFAULT 'aes-256-gcm',
    key_version   INT NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at    TIMESTAMPTZ
);
CREATE INDEX idx_user_keys_user ON user_keys(user_id);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.9 Workflows / Improvements                              ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE workflows (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     INT NOT NULL DEFAULT 1,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    steps       JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_runs (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL REFERENCES workflows(id),
    status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    current_step_id TEXT,
    variables       JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE workflow_step_runs (
    id              TEXT PRIMARY KEY,
    workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    inputs          JSONB NOT NULL DEFAULT '{}',
    outputs         JSONB,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE TABLE improvement_items (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL DEFAULT 'buddy',
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    evidence    JSONB NOT NULL DEFAULT '[]',
    status      TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'implemented')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hq_threads (
    id         TEXT PRIMARY KEY,
    chat_id    TEXT NOT NULL REFERENCES chats(id),
    topic      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at  TIMESTAMPTZ
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2.10 Model Governance                                     ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE model_registry (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    provider    TEXT NOT NULL,
    model_id    TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    is_local    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_policies (
    id         TEXT PRIMARY KEY,
    scope      TEXT NOT NULL CHECK (scope IN ('global', 'chat', 'user')),
    target_id  TEXT,
    model_id   TEXT NOT NULL REFERENCES model_registry(id),
    priority   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_rollouts (
    id            TEXT PRIMARY KEY,
    model_id      TEXT NOT NULL REFERENCES model_registry(id),
    strategy      TEXT NOT NULL DEFAULT 'canary' CHECK (strategy IN ('canary', 'blue_green', 'rolling')),
    traffic_pct   INT NOT NULL DEFAULT 0 CHECK (traffic_pct BETWEEN 0 AND 100),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'rolled_back')),
    metrics       JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Outbox table (for at-least-once delivery)                 ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE TABLE outbox (
    id              TEXT PRIMARY KEY,
    chat_id         TEXT NOT NULL REFERENCES chats(id),
    channel         TEXT NOT NULL,
    channel_chat_id TEXT NOT NULL,
    content_type    TEXT NOT NULL CHECK (content_type IN ('text', 'blocks', 'file', 'audio')),
    text            TEXT,
    blocks          JSONB,
    file_url        TEXT,
    audio_url       TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outbox_status ON outbox(status, created_at);

CREATE TABLE allowlists (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    pattern         TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    danger_tier     INT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_allowlists_type ON allowlists(type, enabled);

-- Done.

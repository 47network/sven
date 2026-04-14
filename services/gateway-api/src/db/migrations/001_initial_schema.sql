-- ═══════════════════════════════════════════════════════════════════════════
-- Sven v0.1.0 – Complete Database Schema
-- Run against: PostgreSQL 16 with pgvector extension
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_bytes

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.1  Core Tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'user'
                        CHECK (role IN ('admin', 'user')),
    password_hash   TEXT NOT NULL,
    totp_secret_enc TEXT,           -- encrypted TOTP seed (NULL = not configured)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_username ON users (username);

CREATE TABLE identities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,     -- discord, slack, telegram, …
    channel_user_id TEXT NOT NULL,     -- stable platform-side id
    display_name    TEXT,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (channel, channel_user_id)
);
CREATE INDEX idx_identities_user ON identities (user_id);

CREATE TABLE chats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL DEFAULT '',
    type            TEXT NOT NULL DEFAULT 'group'
                        CHECK (type IN ('dm', 'group', 'hq')),
    channel         TEXT,              -- NULL if multi-channel / internal
    channel_chat_id TEXT,              -- external chat identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_members (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id   UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chat_id, user_id)
);

CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id             UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_identity_id  UUID REFERENCES identities(id) ON DELETE SET NULL,
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content_type        TEXT NOT NULL CHECK (content_type IN ('text', 'file', 'audio', 'blocks')),
    text                TEXT,
    blocks              JSONB,
    channel_message_id  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_chat      ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_sender    ON messages (sender_user_id);

-- Sessions (admin + user auth)
CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'pending_totp', 'revoked')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sessions_user   ON sessions (user_id);
CREATE INDEX idx_sessions_status ON sessions (status, expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.2  Policy / Tools / Audit
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE tools (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL UNIQUE,
    display_name        TEXT NOT NULL DEFAULT '',
    category            TEXT NOT NULL DEFAULT 'general',
    description         TEXT NOT NULL DEFAULT '',
    version             TEXT NOT NULL DEFAULT '0.0.0',
    execution_mode      TEXT NOT NULL DEFAULT 'container'
                            CHECK (execution_mode IN ('in_process', 'container', 'gvisor', 'firecracker')),
    inputs_schema       JSONB NOT NULL DEFAULT '{}'::jsonb,
    tool_logs            JSONB,
    outputs_schema      JSONB NOT NULL DEFAULT '{}'::jsonb,
    permissions_required TEXT[] NOT NULL DEFAULT '{}',
    resource_limits     JSONB NOT NULL DEFAULT '{"timeout_ms": 30000, "cpu_limit": "0.5", "memory_limit": "256m", "max_bytes": 10485760, "max_concurrency": 1}'::jsonb,
    timeout_seconds     INT NOT NULL DEFAULT 30,
    timeout_ms          INT NOT NULL DEFAULT 30000,
    max_memory_mb       INT NOT NULL DEFAULT 256,
    max_cpu_shares      INT NOT NULL DEFAULT 512,
    max_bytes           BIGINT NOT NULL DEFAULT 10485760,
    max_concurrency     INT NOT NULL DEFAULT 1,
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    is_first_party      BOOLEAN NOT NULL DEFAULT FALSE,
    trust_level         TEXT NOT NULL DEFAULT 'quarantined'
                            CHECK (trust_level IN ('trusted', 'quarantined', 'blocked')),
    status              TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled', 'deprecated')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope        TEXT NOT NULL,                  -- e.g. 'ha.write', 'nas.read'
    effect       TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    target_type  TEXT NOT NULL CHECK (target_type IN ('user', 'chat', 'global')),
    target_id    UUID,                           -- NULL when target_type = 'global'
    conditions   JSONB,
    created_by   TEXT NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_permissions_scope  ON permissions (scope);
CREATE INDEX idx_permissions_target ON permissions (target_type, target_id);

CREATE TABLE approvals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id             UUID NOT NULL REFERENCES chats(id),
    tool_name           TEXT NOT NULL,
    scope               TEXT NOT NULL,
    requester_user_id   TEXT NOT NULL REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'denied', 'expired')),
    quorum_required     INT NOT NULL DEFAULT 1,
    votes_approve       INT NOT NULL DEFAULT 0,
    votes_deny          INT NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ NOT NULL,
    details             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);
CREATE INDEX idx_approvals_chat   ON approvals (chat_id, status);
CREATE INDEX idx_approvals_status ON approvals (status, expires_at);

CREATE TABLE approval_votes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_id  UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    voter_user_id TEXT NOT NULL REFERENCES users(id),
    vote         TEXT NOT NULL CHECK (vote IN ('approve', 'deny')),
    voted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (approval_id, voter_user_id)
);

CREATE TABLE tool_runs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name           TEXT NOT NULL,
    chat_id             UUID NOT NULL REFERENCES chats(id),
    user_id             TEXT NOT NULL REFERENCES users(id),
    approval_id         UUID REFERENCES approvals(id),
    status              TEXT NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'success', 'error', 'timeout', 'denied')),
    inputs              JSONB NOT NULL DEFAULT '{}'::jsonb,
    outputs             JSONB,
    error               TEXT,
    prev_hash           TEXT NOT NULL DEFAULT '',
    run_hash            TEXT NOT NULL DEFAULT '',
    canonical_io_sha256 TEXT NOT NULL DEFAULT '',
    duration_ms         INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);
CREATE INDEX idx_tool_runs_chat   ON tool_runs (chat_id, created_at DESC);
CREATE INDEX idx_tool_runs_tool   ON tool_runs (tool_name, created_at DESC);
CREATE INDEX idx_tool_runs_status ON tool_runs (status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.3  Memory / Identity
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE sven_identity_docs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope       TEXT NOT NULL CHECK (scope IN ('global', 'chat')),
    chat_id     UUID REFERENCES chats(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    version     INT NOT NULL DEFAULT 1,
    updated_by  TEXT NOT NULL REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_identity_docs_global ON sven_identity_docs (scope) WHERE scope = 'global';
CREATE UNIQUE INDEX idx_identity_docs_chat   ON sven_identity_docs (scope, chat_id) WHERE scope = 'chat';

CREATE TABLE chat_persona (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE UNIQUE,
    persona     TEXT NOT NULL DEFAULT '',
    tone        TEXT,
    constraints TEXT,
    updated_by  TEXT NOT NULL REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    chat_id     UUID REFERENCES chats(id) ON DELETE CASCADE,
    visibility  TEXT NOT NULL CHECK (visibility IN ('user_private', 'chat_shared', 'global')),
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    embedding   vector(1536),          -- for semantic lookup
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memories_user       ON memories (user_id, visibility);
CREATE INDEX idx_memories_chat       ON memories (chat_id, visibility);
CREATE INDEX idx_memories_embedding  ON memories USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.4  Canvas / Artifacts
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE canvas_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    blocks      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_canvas_events_chat ON canvas_events (chat_id, created_at DESC);

CREATE TABLE artifacts (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id           UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id        UUID REFERENCES messages(id) ON DELETE SET NULL,
    tool_run_id       UUID REFERENCES tool_runs(id) ON DELETE SET NULL,
    name              TEXT NOT NULL DEFAULT '',
    mime_type         TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes        BIGINT NOT NULL DEFAULT 0,
    storage_path      TEXT NOT NULL,
    is_private        BOOLEAN NOT NULL DEFAULT FALSE,
    enc_alg           TEXT,          -- e.g. 'aes-256-gcm'
    enc_kid           TEXT,          -- key ID reference
    ciphertext_sha256 TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_artifacts_chat ON artifacts (chat_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.5  Registry
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE registry_sources (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL CHECK (type IN ('public', 'private', 'local')),
    url         TEXT,
    path        TEXT,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registry_publishers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL UNIQUE,
    trusted     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skills_catalog (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id       UUID NOT NULL REFERENCES registry_sources(id) ON DELETE CASCADE,
    publisher_id    UUID REFERENCES registry_publishers(id),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    version         TEXT NOT NULL DEFAULT '0.0.0',
    format          TEXT NOT NULL CHECK (format IN ('openclaw', 'oci')),
    manifest        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, name, version)
);

CREATE TABLE skills_installed (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_entry_id  UUID NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
    tool_id           UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    trust_level       TEXT NOT NULL DEFAULT 'quarantined'
                          CHECK (trust_level IN ('trusted', 'quarantined', 'blocked')),
    installed_by      TEXT NOT NULL REFERENCES users(id),
    installed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_signatures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id        UUID NOT NULL REFERENCES skills_installed(id) ON DELETE CASCADE,
    signature_type  TEXT NOT NULL DEFAULT 'cosign',   -- cosign, gpg
    signature       TEXT NOT NULL,
    public_key      TEXT NOT NULL,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE skill_quarantine_reports (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id        UUID NOT NULL REFERENCES skills_installed(id) ON DELETE CASCADE,
    static_checks   JSONB NOT NULL DEFAULT '{}'::jsonb,
    sbom            JSONB,                             -- Syft SBOM
    vuln_scan       JSONB,                             -- Grype / Trivy results
    overall_risk    TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (overall_risk IN ('low', 'medium', 'high', 'critical', 'unknown')),
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.6  Settings / Performance / Buddy
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE settings_global (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.7  Encryption (User Keys)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE user_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    wrapped_dek     BYTEA NOT NULL,           -- DEK encrypted by master KEK
    kek_id          TEXT NOT NULL,             -- references the master key id in SOPS/age/Vault
    algorithm       TEXT NOT NULL DEFAULT 'aes-256-gcm',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at      TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.8  Workflows / Improvements
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE workflows (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version     INT NOT NULL DEFAULT 1,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
    current_step_id TEXT,
    context         JSONB NOT NULL DEFAULT '{}'::jsonb,    -- runtime variables
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_workflow_runs_wf ON workflow_runs (workflow_id, started_at DESC);

CREATE TABLE workflow_step_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_id         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    inputs          JSONB NOT NULL DEFAULT '{}'::jsonb,
    outputs         JSONB,
    error           TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_wf_step_runs ON workflow_step_runs (workflow_run_id);

CREATE TABLE improvement_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source      TEXT NOT NULL DEFAULT 'buddy',   -- buddy, admin, user
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    evidence    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- message IDs, tool run IDs, etc.
    status      TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed', 'accepted', 'in_progress', 'completed', 'rejected')),
    priority    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hq_threads (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    topic       TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'resolved', 'archived')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.9  Model Governance
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE model_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    provider        TEXT NOT NULL,          -- ollama, vllm, openai, anthropic, …
    model_id        TEXT NOT NULL,          -- e.g. 'llama3:70b'
    endpoint        TEXT NOT NULL,
    capabilities    TEXT[] NOT NULL DEFAULT '{}',  -- chat, embed, code, vision, …
    is_local        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, model_id)
);

CREATE TABLE model_policies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope       TEXT NOT NULL CHECK (scope IN ('global', 'chat', 'user')),
    target_id   UUID,
    model_id    UUID NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
    priority    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_model_policies_scope ON model_policies (scope, target_id);

CREATE TABLE model_rollouts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id        UUID NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
    strategy        TEXT NOT NULL DEFAULT 'canary'
                        CHECK (strategy IN ('canary', 'blue_green', 'rolling')),
    traffic_pct     INT NOT NULL DEFAULT 0 CHECK (traffic_pct BETWEEN 0 AND 100),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'completed', 'rolled_back')),
    metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.10  Outbox (for adapter delivery)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE outbox (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id         UUID NOT NULL REFERENCES chats(id),
    channel         TEXT NOT NULL,
    channel_chat_id TEXT NOT NULL,
    content_type    TEXT NOT NULL CHECK (content_type IN ('text', 'blocks', 'file', 'audio')),
    text            TEXT,
    blocks          JSONB,
    file_url        TEXT,
    audio_url       TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'error')),
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at         TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_outbox_pending ON outbox (status, created_at) WHERE status = 'pending';
CREATE INDEX idx_outbox_channel ON outbox (channel, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.11  Allowlists (NAS, web domains, HA entities, git repos)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE allowlists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        TEXT NOT NULL,            -- 'nas_path', 'web_domain', 'ha_entity', 'ha_service', 'git_repo'
    pattern     TEXT NOT NULL,            -- the path/domain/entity
    description TEXT NOT NULL DEFAULT '',
    danger_tier INT,                      -- for HA: 1 (safe), 2 (approval), 3 (quorum+short expiry)
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_allowlists_type ON allowlists (type, enabled);

-- ═══════════════════════════════════════════════════════════════════════════
-- Updated-at triggers (auto-set updated_at on UPDATE)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'users', 'chats', 'tools', 'memories', 'workflows', 'improvement_items',
            'hq_threads', 'model_rollouts', 'outbox'
        ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Migration tracking (simple, no external tool dependency)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS _migrations (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO _migrations (name) VALUES ('001_initial_schema');

COMMIT;

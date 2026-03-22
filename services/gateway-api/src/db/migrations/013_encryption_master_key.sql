-- 2.8 Encryption: Master key configuration
-- The master key is stored externally (SOPS/age or Vault) and referenced via environment variable
-- or settings. This migration sets up the infrastructure for master key versioning.

CREATE TABLE master_key_metadata (
    id                TEXT PRIMARY KEY,
    key_version       INT NOT NULL,
    algorithm         TEXT NOT NULL DEFAULT 'aes-256-gcm',
    key_ref           TEXT NOT NULL,        -- e.g., 'env://SVEN_MASTER_KEY_V1', 'sops://master-key-v1', 'vault://secret/master-key#v1'
    kdf_algorithm     TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
    kdf_iterations    INT NOT NULL DEFAULT 100000,
    salt_ref          TEXT NOT NULL,        -- salt stored separately (also via SOPS/Vault)
    is_active         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deprecated_at     TIMESTAMPTZ,
    rotation_notes    TEXT
);

CREATE INDEX idx_master_key_active ON master_key_metadata(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_master_key_version ON master_key_metadata(key_version);

-- Track key rotation events for audit purposes
CREATE TABLE key_rotation_events (
    id                TEXT PRIMARY KEY,
    from_key_version  INT,           -- NULL for initial key creation
    to_key_version    INT NOT NULL,
    event_type        TEXT NOT NULL, -- 'created', 'rotated', 'revoked'
    reason            TEXT,
    triggered_by      TEXT,          -- user_id of admin who initiated
    status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    affected_rows     INT,           -- number of user_keys re-encrypted
    error_message     TEXT,
    started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_key_rotation_events_to_key ON key_rotation_events(to_key_version);
CREATE INDEX idx_key_rotation_events_status ON key_rotation_events(status);
CREATE INDEX idx_key_rotation_events_completed ON key_rotation_events(completed_at DESC);

-- Seed initial master key metadata (key must be created separately in SOPS/Vault before this)
INSERT INTO master_key_metadata (
    id,
    key_version,
    algorithm,
    key_ref,
    kdf_algorithm,
    kdf_iterations,
    salt_ref,
    is_active,
    created_at
) VALUES (
    'mkey-v1',
    1,
    'aes-256-gcm',
    'env://SVEN_MASTER_KEY_V1',
    'pbkdf2-sha256',
    100000,
    'env://SVEN_MASTER_SALT_V1',
    TRUE,
    NOW()
);

-- Insert initial key rotation event (creation)
INSERT INTO key_rotation_events (
    id,
    from_key_version,
    to_key_version,
    event_type,
    reason,
    triggered_by,
    status,
    started_at,
    completed_at
) VALUES (
    'kr-initial',
    NULL,
    1,
    'created',
    'Initial master key setup',
    'system',
    'completed',
    NOW(),
    NOW()
);

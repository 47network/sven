-- Migration: Gemma 4 integration tables (Batch 6: 6.1-6.17)
-- Model selection, smart routing, on-device memory sync, community bridge,
-- module system, privacy isolation, and capability maps.

BEGIN;

-- ============================================================
-- 6.1 Model Selection: Platform-aware model profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_model_profiles (
    id                         TEXT PRIMARY KEY,
    organization_id            TEXT NOT NULL,
    model_key                  TEXT NOT NULL,
    model_name                 TEXT NOT NULL,
    provider                   TEXT NOT NULL DEFAULT 'on_device'
                               CHECK (provider IN ('on_device', 'ollama', 'litellm', 'custom')),
    platform_type              TEXT NOT NULL
                               CHECK (platform_type IN ('flutter_mobile', 'tauri_desktop', 'server', 'web', 'cli')),
    parameter_count            TEXT NOT NULL DEFAULT 'unknown',
    quantization               TEXT NOT NULL DEFAULT 'unknown',
    context_window             INTEGER NOT NULL DEFAULT 4096,
    supports_audio             BOOLEAN NOT NULL DEFAULT FALSE,
    supports_vision            BOOLEAN NOT NULL DEFAULT FALSE,
    supports_function_calling  BOOLEAN NOT NULL DEFAULT FALSE,
    license                    TEXT NOT NULL DEFAULT 'Apache-2.0',
    is_default                 BOOLEAN NOT NULL DEFAULT FALSE,
    is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, model_key)
);
COMMENT ON TABLE gemma4_model_profiles IS '6.1 Platform-aware model profiles for Gemma 4 and custom models';
CREATE INDEX idx_gemma4_profiles_org ON gemma4_model_profiles (organization_id, platform_type, is_active);

-- ============================================================
-- 6.4 Smart Routing: Local/cloud routing policies and decisions
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_routing_policies (
    id                          TEXT PRIMARY KEY,
    organization_id             TEXT NOT NULL UNIQUE,
    local_complexity_threshold  TEXT NOT NULL DEFAULT 'moderate'
                                CHECK (local_complexity_threshold IN ('simple', 'moderate', 'complex')),
    prefer_local                BOOLEAN NOT NULL DEFAULT TRUE,
    offline_mode_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
    cloud_fallback_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    max_local_token_count       INTEGER NOT NULL DEFAULT 4096,
    max_cloud_token_count       INTEGER NOT NULL DEFAULT 32768,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_routing_policies IS '6.4 Per-org local/cloud smart routing policies';

CREATE TABLE IF NOT EXISTS gemma4_routing_decisions (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    target               TEXT NOT NULL CHECK (target IN ('local', 'cloud', 'fallback_local')),
    complexity           TEXT NOT NULL CHECK (complexity IN ('simple', 'moderate', 'complex', 'unknown')),
    reason               TEXT NOT NULL,
    is_offline           BOOLEAN NOT NULL DEFAULT FALSE,
    latency_estimate_ms  INTEGER NOT NULL DEFAULT 0,
    prompt_length        INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_routing_decisions IS '6.4 Routing decision audit log for analytics';
CREATE INDEX idx_gemma4_routing_org ON gemma4_routing_decisions (organization_id, created_at DESC);
CREATE INDEX idx_gemma4_routing_target ON gemma4_routing_decisions (organization_id, target, complexity);

-- ============================================================
-- 6.5 On-Device Memory: Sync manifests and batches
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_device_sync_manifests (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    device_id            TEXT NOT NULL,
    platform             TEXT NOT NULL,
    last_sync_at         TIMESTAMPTZ,
    sync_cursor          TEXT NOT NULL DEFAULT '',
    memories_on_device   INTEGER NOT NULL DEFAULT 0,
    pending_uploads      INTEGER NOT NULL DEFAULT 0,
    pending_downloads    INTEGER NOT NULL DEFAULT 0,
    sync_status          TEXT NOT NULL DEFAULT 'registered'
                         CHECK (sync_status IN ('registered', 'syncing', 'synced', 'error')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id, device_id)
);
COMMENT ON TABLE gemma4_device_sync_manifests IS '6.5 Per-device memory sync state tracking';
CREATE INDEX idx_gemma4_sync_user ON gemma4_device_sync_manifests (organization_id, user_id);

CREATE TABLE IF NOT EXISTS gemma4_sync_batches (
    id               TEXT PRIMARY KEY,
    manifest_id      TEXT NOT NULL REFERENCES gemma4_device_sync_manifests(id) ON DELETE CASCADE,
    direction        TEXT NOT NULL CHECK (direction IN ('upload', 'download')),
    record_count     INTEGER NOT NULL DEFAULT 0,
    byte_size        INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_message    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);
COMMENT ON TABLE gemma4_sync_batches IS '6.5 Sync batch records for upload/download tracking';
CREATE INDEX idx_gemma4_batches_manifest ON gemma4_sync_batches (manifest_id, created_at DESC);

-- ============================================================
-- 6.6 Community Bridge: On-device agent ↔ community events
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_community_bridge_config (
    id                       TEXT PRIMARY KEY,
    organization_id          TEXT NOT NULL,
    user_id                  TEXT NOT NULL,
    auto_file_bugs           BOOLEAN NOT NULL DEFAULT FALSE,
    auto_share_insights      BOOLEAN NOT NULL DEFAULT FALSE,
    auto_request_features    BOOLEAN NOT NULL DEFAULT FALSE,
    min_confidence_to_share  DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);
COMMENT ON TABLE gemma4_community_bridge_config IS '6.6 Per-user community bridge configuration';

CREATE TABLE IF NOT EXISTS gemma4_community_bridge_events (
    id                       TEXT PRIMARY KEY,
    organization_id          TEXT NOT NULL,
    user_id                  TEXT NOT NULL,
    device_id                TEXT NOT NULL,
    action                   TEXT NOT NULL
                             CHECK (action IN ('file_bug', 'request_feature', 'share_insight', 'ask_question', 'vote')),
    payload                  JSONB DEFAULT '{}',
    consent_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    consent_level            TEXT NOT NULL DEFAULT 'OFF',
    target_community_topic   TEXT,
    remote_entity_id         TEXT,
    status                   TEXT NOT NULL DEFAULT 'submitted'
                             CHECK (status IN ('submitted', 'processing', 'completed', 'rejected', 'failed')),
    error_message            TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_community_bridge_events IS '6.6 Bridge events from local agent to community';
CREATE INDEX idx_gemma4_bridge_user ON gemma4_community_bridge_events (organization_id, user_id, created_at DESC);
CREATE INDEX idx_gemma4_bridge_action ON gemma4_community_bridge_events (organization_id, action, status);

-- ============================================================
-- 6.7+6.8 Module System: Catalog and device installs
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_module_catalog (
    id                TEXT PRIMARY KEY,
    module_key        TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL DEFAULT 'model'
                      CHECK (category IN ('model', 'voice', 'vision', 'tool', 'language', 'plugin')),
    version           TEXT NOT NULL DEFAULT '1.0.0',
    size_bytes        BIGINT NOT NULL DEFAULT 0,
    platforms         JSONB NOT NULL DEFAULT '["all"]',
    min_ram_mb        INTEGER NOT NULL DEFAULT 0,
    min_storage_mb    INTEGER NOT NULL DEFAULT 0,
    requires_gpu      BOOLEAN NOT NULL DEFAULT FALSE,
    download_url      TEXT NOT NULL DEFAULT '',
    checksum_sha256   TEXT NOT NULL DEFAULT '',
    license           TEXT NOT NULL DEFAULT 'Apache-2.0',
    is_default        BOOLEAN NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_module_catalog IS '6.7 Auto-download module catalog';
CREATE INDEX idx_gemma4_modules_category ON gemma4_module_catalog (category, is_active);

CREATE TABLE IF NOT EXISTS gemma4_device_module_installs (
    id                  TEXT PRIMARY KEY,
    organization_id     TEXT NOT NULL,
    user_id             TEXT NOT NULL,
    device_id           TEXT NOT NULL,
    module_id           TEXT NOT NULL REFERENCES gemma4_module_catalog(id) ON DELETE CASCADE,
    module_key          TEXT NOT NULL,
    installed_version   TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'downloading'
                        CHECK (status IN ('downloading', 'installed', 'updating', 'failed', 'uninstalled')),
    download_progress   INTEGER NOT NULL DEFAULT 0,
    installed_at        TIMESTAMPTZ,
    last_used_at        TIMESTAMPTZ,
    disk_usage_bytes    BIGINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id, device_id, module_id)
);
COMMENT ON TABLE gemma4_device_module_installs IS '6.7+6.8 Per-device module install tracking';
CREATE INDEX idx_gemma4_installs_device ON gemma4_device_module_installs (organization_id, user_id, device_id);

-- ============================================================
-- 6.11+6.13 Privacy Isolation: Policies and audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_privacy_policies (
    id                      TEXT PRIMARY KEY,
    organization_id         TEXT NOT NULL,
    user_id                 TEXT NOT NULL,
    local_inference_only    BOOLEAN NOT NULL DEFAULT TRUE,
    block_telemetry         BOOLEAN NOT NULL DEFAULT TRUE,
    block_crash_reports     BOOLEAN NOT NULL DEFAULT TRUE,
    block_usage_analytics   BOOLEAN NOT NULL DEFAULT TRUE,
    allow_model_updates     BOOLEAN NOT NULL DEFAULT TRUE,
    allow_module_downloads  BOOLEAN NOT NULL DEFAULT TRUE,
    offline_mode_forced     BOOLEAN NOT NULL DEFAULT FALSE,
    data_retention_days     INTEGER NOT NULL DEFAULT 365,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);
COMMENT ON TABLE gemma4_privacy_policies IS '6.11+6.13 Privacy and offline mode policies';
CREATE INDEX idx_gemma4_privacy_user ON gemma4_privacy_policies (organization_id, user_id);

CREATE TABLE IF NOT EXISTS gemma4_privacy_audit_log (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    event_type        TEXT NOT NULL,
    blocked           BOOLEAN NOT NULL DEFAULT FALSE,
    reason            TEXT NOT NULL DEFAULT '',
    details           JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_privacy_audit_log IS '6.11 Privacy enforcement audit log';
CREATE INDEX idx_gemma4_privacy_audit ON gemma4_privacy_audit_log (organization_id, user_id, created_at DESC);

-- ============================================================
-- 6.10+6.17 Model Agnosticism & Capabilities
-- ============================================================
CREATE TABLE IF NOT EXISTS gemma4_capability_maps (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT NOT NULL,
    model_profile_id   TEXT NOT NULL REFERENCES gemma4_model_profiles(id) ON DELETE CASCADE,
    capability         TEXT NOT NULL
                       CHECK (capability IN (
                         'function_calling', 'audio_input', 'audio_output', 'vision',
                         'structured_json', 'system_instructions', 'agentic_workflows',
                         'multilingual', 'code_generation', 'image_processing',
                         'speech_to_text', 'device_control'
                       )),
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    config             JSONB DEFAULT '{}',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, model_profile_id, capability)
);
COMMENT ON TABLE gemma4_capability_maps IS '6.10+6.17 Per-model capability toggles and config';
CREATE INDEX idx_gemma4_caps_model ON gemma4_capability_maps (organization_id, model_profile_id);

CREATE TABLE IF NOT EXISTS gemma4_custom_model_slots (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    slot_name         TEXT NOT NULL,
    model_format      TEXT NOT NULL CHECK (model_format IN ('gguf', 'safetensors', 'onnx', 'tflite', 'mediapipe')),
    model_path        TEXT NOT NULL DEFAULT '',
    model_size_bytes  BIGINT NOT NULL DEFAULT 0,
    quantization      TEXT NOT NULL DEFAULT 'unknown',
    context_window    INTEGER NOT NULL DEFAULT 4096,
    capabilities      JSONB DEFAULT '[]',
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE gemma4_custom_model_slots IS '6.10 BYOM — bring your own model slots';
CREATE INDEX idx_gemma4_custom_user ON gemma4_custom_model_slots (organization_id, user_id, is_active);

COMMIT;

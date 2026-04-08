-- Migration 170: Image Processing Pipeline + Audio Scribe + Device Actions
-- Roadmap items 6.12, 6.14, 6.15
BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 6.12  Image Processing Pipeline
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS image_escalation_policies (
    id                         TEXT PRIMARY KEY,
    organization_id            TEXT NOT NULL UNIQUE,
    auto_escalate              BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_threshold       NUMERIC(3,2) NOT NULL DEFAULT 0.60,
    max_local_processing_ms    INTEGER NOT NULL DEFAULT 5000,
    allowed_categories         JSONB NOT NULL DEFAULT '["photo","screenshot","document","handwriting","chart","diagram"]',
    prefer_local               BOOLEAN NOT NULL DEFAULT TRUE,
    ocr_enabled                BOOLEAN NOT NULL DEFAULT TRUE,
    handwriting_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_processing_jobs (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    image_ref            TEXT NOT NULL,
    category             TEXT NOT NULL
                         CHECK (category IN ('photo','screenshot','document','handwriting','chart','diagram','other')),
    target               TEXT NOT NULL
                         CHECK (target IN ('local','server','fallback_server')),
    status               TEXT NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued','processing','completed','failed','escalated')),
    local_confidence     NUMERIC(4,3) NOT NULL DEFAULT 0.000,
    escalation_reason    TEXT,
    result_summary       TEXT,
    result_data          JSONB,
    processing_ms        INTEGER,
    model_used           TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_image_jobs_org
    ON image_processing_jobs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_jobs_status
    ON image_processing_jobs (organization_id, status);

-- ─────────────────────────────────────────────────────────────
-- 6.14  Audio Scribe Local Processing
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audio_scribe_configs (
    id                           TEXT PRIMARY KEY,
    organization_id              TEXT NOT NULL UNIQUE,
    prefer_local                 BOOLEAN NOT NULL DEFAULT TRUE,
    max_local_duration_seconds   INTEGER NOT NULL DEFAULT 30,
    auto_detect_language         BOOLEAN NOT NULL DEFAULT TRUE,
    default_language             TEXT NOT NULL DEFAULT 'en',
    noise_reduction              BOOLEAN NOT NULL DEFAULT TRUE,
    punctuation_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    speaker_diarization          BOOLEAN NOT NULL DEFAULT FALSE,
    real_time_mode               BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_scribe_sessions (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    user_id              TEXT NOT NULL,
    source               TEXT NOT NULL
                         CHECK (source IN ('microphone','voice_note','meeting','lecture','uploaded_file')),
    target               TEXT NOT NULL
                         CHECK (target IN ('local','server')),
    status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','recording','processing','completed','failed')),
    duration_seconds     INTEGER,
    transcript           TEXT,
    language_detected    TEXT,
    confidence           NUMERIC(4,3),
    word_count           INTEGER,
    model_used           TEXT,
    processing_ms        INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scribe_sessions_org
    ON audio_scribe_sessions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scribe_sessions_status
    ON audio_scribe_sessions (organization_id, status);

-- ─────────────────────────────────────────────────────────────
-- 6.15  Mobile Actions / Device Control
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_actions (
    id                     TEXT PRIMARY KEY,
    organization_id        TEXT NOT NULL,
    name                   TEXT NOT NULL,
    description            TEXT NOT NULL DEFAULT '',
    category               TEXT NOT NULL
                           CHECK (category IN ('navigation','automation','device_control','app_interaction','system','custom')),
    platform               TEXT NOT NULL DEFAULT 'any'
                           CHECK (platform IN ('android','ios','desktop_macos','desktop_windows','desktop_linux','any')),
    function_schema        JSONB NOT NULL DEFAULT '{}',
    requires_confirmation  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_device_actions_org
    ON device_actions (organization_id, category);

CREATE TABLE IF NOT EXISTS device_action_executions (
    id                TEXT PRIMARY KEY,
    organization_id   TEXT NOT NULL,
    user_id           TEXT NOT NULL,
    action_id         TEXT NOT NULL REFERENCES device_actions(id) ON DELETE CASCADE,
    action_name       TEXT NOT NULL,
    device_id         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('registered','pending','executing','completed','failed','cancelled')),
    input_params      JSONB NOT NULL DEFAULT '{}',
    result            JSONB,
    error_message     TEXT,
    execution_ms      INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_executions_org
    ON device_action_executions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_executions_device
    ON device_action_executions (device_id, created_at DESC);

CREATE TABLE IF NOT EXISTS device_action_policies (
    id                         TEXT PRIMARY KEY,
    organization_id            TEXT NOT NULL UNIQUE,
    allow_device_control       BOOLEAN NOT NULL DEFAULT TRUE,
    allow_app_navigation       BOOLEAN NOT NULL DEFAULT TRUE,
    allow_system_actions       BOOLEAN NOT NULL DEFAULT TRUE,
    require_confirmation_all   BOOLEAN NOT NULL DEFAULT FALSE,
    max_actions_per_minute     INTEGER NOT NULL DEFAULT 30,
    blocked_actions            JSONB NOT NULL DEFAULT '[]',
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

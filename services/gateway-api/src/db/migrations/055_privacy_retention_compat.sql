-- Migration: Privacy retention compatibility for text-id schema
-- Version: 055

CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('global', 'per_chat', 'per_user')),
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  message_retention_days INTEGER DEFAULT 90,
  message_artifacts_days INTEGER DEFAULT 365,
  message_logs_days INTEGER DEFAULT 30,
  tool_runs_days INTEGER DEFAULT 90,
  voice_transcripts_days INTEGER DEFAULT 60,
  metadata_retention_days INTEGER DEFAULT 730,
  auto_delete_expired BOOLEAN DEFAULT true,
  compress_after_days INTEGER DEFAULT 30,
  archive_to_nas BOOLEAN DEFAULT false,
  notify_before_deletion BOOLEAN DEFAULT true,
  redact_pii_before_storage BOOLEAN DEFAULT false,
  redact_patterns TEXT[],
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_policies_scope_unique
  ON retention_policies(type, COALESCE(chat_id, ''), COALESCE(user_id, ''));
CREATE INDEX IF NOT EXISTS idx_retention_policies_type_user ON retention_policies(type, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_retention_policies_type_chat ON retention_policies(type, chat_id) WHERE chat_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'retention_policies'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE retention_policies
      ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS data_export_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('all', 'messages', 'artifacts', 'metadata', 'tool_runs', 'voice', 'custom')),
  custom_filters JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'archived')),
  progress_percentage INTEGER DEFAULT 0,
  file_uri VARCHAR(500),
  file_format VARCHAR(20) DEFAULT 'json' CHECK (file_format IN ('json', 'csv', 'parquet')),
  file_size_bytes BIGINT,
  file_hash VARCHAR(64),
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_status ON data_export_requests(user_id, status);

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  deletion_type VARCHAR(50) NOT NULL CHECK (deletion_type IN ('soft_delete', 'hard_delete', 'anonymize', 'purge')),
  include_metadata BOOLEAN DEFAULT true,
  include_artifacts BOOLEAN DEFAULT true,
  include_voice BOOLEAN DEFAULT true,
  include_tool_runs BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
  confirmed_by TEXT REFERENCES users(id),
  confirmation_timestamp TIMESTAMPTZ,
  reason TEXT,
  deleted_records_count INTEGER DEFAULT 0,
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_status ON data_deletion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_chat_status ON data_deletion_requests(chat_id, status);

CREATE TABLE IF NOT EXISTS pii_flags (
  id TEXT PRIMARY KEY,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  pii_type VARCHAR(50) NOT NULL,
  detected_value TEXT,
  confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  detection_method VARCHAR(50),
  action_taken VARCHAR(50),
  reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT REFERENCES users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pii_flags_chat_type ON pii_flags(chat_id, pii_type, created_at DESC);

CREATE TABLE IF NOT EXISTS redaction_rules (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pattern TEXT NOT NULL,
  replacement VARCHAR(50) DEFAULT '[REDACTED]',
  pii_type VARCHAR(50),
  apply_globally BOOLEAN DEFAULT true,
  apply_to_users TEXT[],
  apply_to_chats TEXT[],
  apply_to_message_types TEXT[],
  enabled BOOLEAN DEFAULT true,
  test_results JSONB,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_redaction_rules_enabled ON redaction_rules(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS retention_audit_log (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  target_user_id TEXT REFERENCES users(id),
  target_chat_id TEXT REFERENCES chats(id),
  details JSONB,
  actor_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_retention_audit_action_created ON retention_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_audit_user_created ON retention_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_audit_chat_created ON retention_audit_log(target_chat_id, created_at DESC);

INSERT INTO retention_policies (
  id, type, message_retention_days, message_artifacts_days, message_logs_days, tool_runs_days,
  voice_transcripts_days, metadata_retention_days, auto_delete_expired, notify_before_deletion
)
SELECT 'global-default', 'global', 90, 365, 30, 90, 60, 730, true, true
WHERE NOT EXISTS (
  SELECT 1
  FROM retention_policies
  WHERE type = 'global'
    AND chat_id IS NULL
    AND user_id IS NULL
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

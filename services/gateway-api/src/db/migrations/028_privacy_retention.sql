-- Migration: Privacy and Data Retention
-- Version: 028
-- Purpose: Add retention policies, data export/deletion tracking, and redaction rules

-- Retention policies (per-chat and per-user)
CREATE TABLE retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('global', 'per_chat', 'per_user')),
  
  -- Target scope
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  
  -- Retention settings (days, 0 = indefinite)
  message_retention_days INTEGER DEFAULT 90,
  message_artifacts_days INTEGER DEFAULT 365,
  message_logs_days INTEGER DEFAULT 30,
  tool_runs_days INTEGER DEFAULT 90,
  voice_transcripts_days INTEGER DEFAULT 60,
  metadata_retention_days INTEGER DEFAULT 730, -- 2 years for audit
  
  -- Action settings
  auto_delete_expired BOOLEAN DEFAULT true,
  compress_after_days INTEGER DEFAULT 30,
  archive_to_nas BOOLEAN DEFAULT false,
  notify_before_deletion BOOLEAN DEFAULT true,
  
  -- Redaction settings
  redact_pii_before_storage BOOLEAN DEFAULT false,
  redact_patterns TEXT[], -- Array of regex patterns to redact
  
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(type, chat_id, user_id)
);

-- Data export requests
CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE, -- Null = all chats
  
  export_type VARCHAR(50) NOT NULL CHECK (export_type IN (
    'all', 'messages', 'artifacts', 'metadata', 'tool_runs', 'voice', 'custom'
  )),
  
  custom_filters JSONB, -- Custom filter criteria
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'archived'
  )),
  
  progress_percentage INTEGER DEFAULT 0,
  
  -- File generation
  file_uri VARCHAR(500), -- S3/NAS path to exported data
  file_format VARCHAR(20) DEFAULT 'json' CHECK (file_format IN ('json', 'csv', 'parquet')),
  file_size_bytes BIGINT,
  file_hash VARCHAR(64), -- SHA256 of exported file
  
  expires_at TIMESTAMP, -- When to delete the export file
  
  error_message TEXT,
  
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  UNIQUE(user_id, chat_id, export_type, status)
);

-- Data deletion requests
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE, -- Null = delete entire user
  
  deletion_type VARCHAR(50) NOT NULL CHECK (deletion_type IN (
    'soft_delete', 'hard_delete', 'anonymize', 'purge'
  )),
  
  -- What to delete
  include_metadata BOOLEAN DEFAULT true,
  include_artifacts BOOLEAN DEFAULT true,
  include_voice BOOLEAN DEFAULT true,
  include_tool_runs BOOLEAN DEFAULT false, -- Careful!
  
  -- Approval/confirmation
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'in_progress', 'completed', 'cancelled'
  )),
  confirmed_by TEXT REFERENCES users(id),
  confirmation_timestamp TIMESTAMP,
  
  reason TEXT,
  
  -- Execution
  deleted_records_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_for TIMESTAMP, -- Delayed deletion for recovery window
  completed_at TIMESTAMP
);

-- PII detection and flagging
CREATE TABLE pii_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  
  pii_type VARCHAR(50) NOT NULL CHECK (pii_type IN (
    'email', 'phone', 'ssn', 'credit_card', 'passport', 'address',
    'full_name', 'identification_number', 'api_key', 'token', 'other'
  )),
  
  detected_value TEXT, -- Redacted for safety
  confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  
  detection_method VARCHAR(50), -- 'regex', 'ml_model', 'manual'
  
  -- Action taken
  action_taken VARCHAR(50) CHECK (action_taken IN (
    'flagged', 'redacted', 'quarantined', 'notified'
  )),
  
  -- Admin review
  reviewed BOOLEAN DEFAULT false,
  reviewed_by TEXT REFERENCES users(id),
  review_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Redaction rules (patterns to apply before storage)
CREATE TABLE redaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pattern matching
  pattern TEXT NOT NULL, -- Regex pattern
  replacement VARCHAR(50) DEFAULT '[REDACTED]',
  
  pii_type VARCHAR(50),
  
  -- Scope
  apply_globally BOOLEAN DEFAULT true,
  apply_to_users TEXT[], -- UUID array, null = all
  apply_to_chats TEXT[], -- UUID array, null = all
  apply_to_message_types TEXT[], -- 'user', 'system', 'tool', etc.
  
  enabled BOOLEAN DEFAULT true,
  
  -- Audit
  test_results JSONB, -- Results of regex testing
  
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data retention audit log
CREATE TABLE retention_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'policy_created', 'policy_updated', 'policy_deleted',
    'export_started', 'export_completed', 'export_failed',
    'deletion_scheduled', 'deletion_executed', 'deletion_failed',
    'data_purged', 'pii_detected', 'pii_flagged', 'redaction_applied'
  )),
  
  resource_type VARCHAR(50), -- 'message', 'artifact', 'chat', 'user', etc.
  resource_id VARCHAR(100),
  
  target_user_id TEXT REFERENCES users(id),
  target_chat_id TEXT REFERENCES chats(id),
  
  details JSONB, -- Context-specific details
  
  actor_user_id TEXT REFERENCES users(id), -- Who performed the action
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default retention policy (if none specified)
INSERT INTO retention_policies (type, message_retention_days, message_artifacts_days, 
  message_logs_days, tool_runs_days, voice_transcripts_days, metadata_retention_days,
  auto_delete_expired, notify_before_deletion)
VALUES (
  'global', 90, 365, 30, 90, 60, 730, true, true
)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_retention_policies_type_user ON retention_policies(type, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_retention_policies_type_chat ON retention_policies(type, chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX idx_data_export_requests_user_status ON data_export_requests(user_id, status);
CREATE INDEX idx_data_deletion_requests_user_status ON data_deletion_requests(user_id, status);
CREATE INDEX idx_pii_flags_chat_type ON pii_flags(chat_id, pii_type, created_at DESC);
CREATE INDEX idx_pii_flags_pii_type_confidence ON pii_flags(pii_type, confidence);
CREATE INDEX idx_redaction_rules_enabled ON redaction_rules(enabled) WHERE enabled = true;
CREATE INDEX idx_redaction_rules_enabled_scope ON redaction_rules(enabled, apply_globally);
CREATE INDEX idx_retention_audit_log_action_created_at ON retention_audit_log(action, created_at DESC);
CREATE INDEX idx_retention_audit_log_target_user_created_at ON retention_audit_log(target_user_id, created_at DESC);
CREATE INDEX idx_retention_audit_log_target_chat_created_at ON retention_audit_log(target_chat_id, created_at DESC);

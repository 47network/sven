-- Incident Response & Safety Controls Migration
-- Supports kill switch, lockdown, forensics, and escalation rules

-- Kill switch state (global, applies instantly to all write scopes)
CREATE TABLE IF NOT EXISTS incident_kill_switch (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enabled BOOLEAN NOT NULL DEFAULT false,
  activated_by TEXT NOT NULL,
  activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  
  -- Tracking
  issue_id TEXT,
  severity VARCHAR(20) -- critical, high, medium, low
);

-- Lockdown mode (forces quarantine on all new skills, disables installations)
CREATE TABLE IF NOT EXISTS incident_lockdown (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enabled BOOLEAN NOT NULL DEFAULT false,
  activated_by TEXT NOT NULL,
  activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  
  -- Configuration
  allow_read_only_tools BOOLEAN DEFAULT true,
  allow_existing_approved BOOLEAN DEFAULT true,
  block_new_installs BOOLEAN DEFAULT true,
  
  -- Tracking
  issue_id TEXT,
  severity VARCHAR(20)
);

-- Forensics mode (pause tools, keep chat/canvas read-only, audit trail boost)
CREATE TABLE IF NOT EXISTS incident_forensics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enabled BOOLEAN NOT NULL DEFAULT false,
  activated_by TEXT NOT NULL,
  activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  notes JSONB DEFAULT '{}'::jsonb,
  
  -- Configuration
  pause_all_tools BOOLEAN DEFAULT true,
  pause_workflows BOOLEAN DEFAULT true,
  pause_approvals BOOLEAN DEFAULT true,
  allow_chat_read BOOLEAN DEFAULT true,
  allow_canvas_read BOOLEAN DEFAULT true,
  boost_audit_logging BOOLEAN DEFAULT true,
  
  -- Tracking
  issue_id TEXT,
  severity VARCHAR(20)
);

-- Incident tracker (master incident record)
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, closed, escalated, resolved
  severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- critical, high, medium, low
  title TEXT NOT NULL,
  description TEXT,
  
  -- Affected systems
  affected_systems TEXT[] DEFAULT '{}',
  
  -- Response modes triggered
  kill_switch_enabled BOOLEAN DEFAULT false,
  lockdown_enabled BOOLEAN DEFAULT false,
  forensics_enabled BOOLEAN DEFAULT false,
  
  -- Timeline
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  detected_by TEXT,
  reported_by TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  
  -- Metadata
  external_issue_ids TEXT[] DEFAULT '{}', -- GitHub, Jira, etc
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Escalation rules for approval aging (auto-escalate old approvals)
CREATE TABLE IF NOT EXISTS escalation_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  
  -- Trigger conditions
  approval_age_minutes INTEGER, -- escalate if approval pending > N minutes
  approval_count_threshold INTEGER, -- escalate if N+ approvals pending
  scope_filter TEXT, -- specific scope or NULL for all
  
  -- Actions
  action_type VARCHAR(50) NOT NULL, -- escalate_to_admin, auto_deny, notify, create_incident
  escalate_to_role VARCHAR(50), -- admin, lead, incident-commander
  notify_channels TEXT[] DEFAULT '{}', -- discord, slack, email, sms
  create_incident BOOLEAN DEFAULT false,
  
  -- Timing
  run_interval_minutes INTEGER DEFAULT 5,
  last_executed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_at TIMESTAMP,
  updated_by TEXT
);

-- Escalation audit log (track each escalation action)
CREATE TABLE IF NOT EXISTS escalation_audit (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id TEXT NOT NULL REFERENCES escalation_rules(id) ON DELETE CASCADE,
  
  -- What triggered
  approval_id TEXT,
  approval_age_minutes INTEGER,
  pending_approval_count INTEGER,
  
  -- Action taken
  action_type VARCHAR(50),
  action_executed BOOLEAN DEFAULT true,
  action_result JSONB,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency notification log (track all emergency alerts sent out)
CREATE TABLE IF NOT EXISTS emergency_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  incident_id TEXT REFERENCES incidents(id) ON DELETE SET NULL,
  
  -- Recipients
  channel VARCHAR(50) NOT NULL, -- discord, slack, email, sms, push
  recipients TEXT[] NOT NULL,
  
  -- Message
  title TEXT,
  message TEXT,
  severity VARCHAR(20),
  action_url TEXT,
  
  -- Delivery tracking
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  delivery_status VARCHAR(50), -- pending, sent, delivered, failed
  delivery_error TEXT,
  ack_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Incident response history (who did what and when)
CREATE TABLE IF NOT EXISTS incident_response_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  
  -- Action
  action_type VARCHAR(50), -- activate_kill_switch, enable_lockdown, etc
  action_description TEXT,
  
  -- Actor
  actor_user_id TEXT,
  actor_role VARCHAR(50),
  
  -- Result
  success BOOLEAN DEFAULT true,
  result_details JSONB,
  
  -- Timestamp
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Safety configuration (global incident settings)
CREATE TABLE IF NOT EXISTS incident_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Kill switch settings
  kill_switch_affects_all_writes BOOLEAN DEFAULT true,
  kill_switch_bypass_whitelist TEXT[] DEFAULT '{}', -- users who can bypass
  
  -- Lockdown settings
  lockdown_read_only_timeout_minutes INTEGER DEFAULT 0, -- 0 = unlimited, or auto-disable after N min
  
  -- Forensics settings
  forensics_max_runtime_hours INTEGER DEFAULT 24,
  forensics_boost_retention_days INTEGER DEFAULT 30,
  
  -- Escalation settings
  escalation_enabled BOOLEAN DEFAULT true,
  max_approval_age_before_auto_deny_minutes INTEGER DEFAULT 1440, -- 24h
  
  -- Emergency contact list
  emergency_contacts JSONB DEFAULT '{}'::jsonb, -- {"discord": [...], "email": [...], "sms": [...]}
  
  -- Metadata
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- Insert default configuration
INSERT INTO incident_config (id, kill_switch_affects_all_writes, lockdown_read_only_timeout_minutes)
VALUES ('default-incident-config', true, 0)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kill_switch_enabled ON incident_kill_switch(enabled);
CREATE INDEX IF NOT EXISTS idx_kill_switch_activated_at ON incident_kill_switch(activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lockdown_enabled ON incident_lockdown(enabled);
CREATE INDEX IF NOT EXISTS idx_lockdown_activated_at ON incident_lockdown(activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forensics_enabled ON incident_forensics(enabled);
CREATE INDEX IF NOT EXISTS idx_forensics_activated_at ON incident_forensics(activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incident_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incident_detected_at ON incidents(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_enabled ON escalation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_last_executed ON escalation_rules(last_executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_audit_rule_id ON escalation_audit(rule_id);
CREATE INDEX IF NOT EXISTS idx_escalation_audit_created_at ON escalation_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_channel ON emergency_notifications(channel);
CREATE INDEX IF NOT EXISTS idx_emergency_sent_at ON emergency_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_incident_id ON emergency_notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_response_log_incident ON incident_response_log(incident_id);
CREATE INDEX IF NOT EXISTS idx_response_log_action_at ON incident_response_log(action_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_config_updated ON incident_config(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_incidents_critical ON incidents(severity, status) WHERE severity = 'critical';

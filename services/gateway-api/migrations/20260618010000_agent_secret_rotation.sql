-- Batch 164: Agent Secret Rotation
-- Automated credential rotation, expiry tracking, rotation policies

CREATE TABLE IF NOT EXISTS agent_rotation_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  policy_name     TEXT NOT NULL,
  secret_pattern  TEXT NOT NULL,
  rotation_type   TEXT NOT NULL CHECK (rotation_type IN ('time_based','usage_based','event_based','manual')),
  interval_hours  INT NOT NULL DEFAULT 720,
  max_age_hours   INT NOT NULL DEFAULT 2160,
  auto_rotate     BOOLEAN NOT NULL DEFAULT true,
  notify_before_h INT NOT NULL DEFAULT 168,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_rotation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES agent_rotation_policies(id),
  secret_name     TEXT NOT NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('rotated','expired','expiring_soon','rotation_failed','manual_override')),
  old_version     TEXT,
  new_version     TEXT,
  rotated_by      TEXT NOT NULL DEFAULT 'system',
  duration_ms     INT,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_rotation_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES agent_rotation_policies(id),
  secret_name     TEXT NOT NULL,
  last_rotated_at TIMESTAMPTZ,
  next_rotation   TIMESTAMPTZ NOT NULL,
  rotation_count  INT NOT NULL DEFAULT 0,
  consecutive_failures INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','failed','skipped')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rotation_policies_tenant ON agent_rotation_policies(tenant_id);
CREATE INDEX idx_rotation_events_policy ON agent_rotation_events(policy_id);
CREATE INDEX idx_rotation_schedule_policy ON agent_rotation_schedule(policy_id);

-- Extend HA automations with state tracking.
ALTER TABLE ha_automations
  ADD COLUMN IF NOT EXISTS cooldown_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_state TEXT,
  ADD COLUMN IF NOT EXISTS last_attributes JSONB,
  ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

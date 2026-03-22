-- Migration: Add lease-based polling columns to outbox and device_commands
-- Required by: adapter outbox polling (v1/outbox/next) and device command dispatch (v1/devices/commands/next)
-- Applied: 2026-03-20
-- Rollback: See DOWN section below

-- ── UP ──────────────────────────────────────────────────────────────
BEGIN;

-- Outbox: lease columns for adapter message delivery
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0;

-- Outbox: allow 'processing' status for leased messages
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_status_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_status_check
  CHECK (status IN ('pending','processing','sent','error'));

-- Outbox: index for efficient lease-based polling
CREATE INDEX IF NOT EXISTS idx_outbox_lease_poll
  ON outbox (channel, status, lease_expires_at)
  WHERE status IN ('pending','processing');

-- Device commands: lease columns for command dispatch
ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS claim_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS result_payload JSONB;
ALTER TABLE device_commands ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMIT;

-- ── DOWN ────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE outbox DROP COLUMN IF EXISTS lease_owner;
-- ALTER TABLE outbox DROP COLUMN IF EXISTS lease_expires_at;
-- ALTER TABLE outbox DROP COLUMN IF EXISTS delivery_attempts;
-- ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_status_check;
-- ALTER TABLE outbox ADD CONSTRAINT outbox_status_check CHECK (status IN ('pending','sent','error'));
-- DROP INDEX IF EXISTS idx_outbox_lease_poll;
-- ALTER TABLE device_commands DROP COLUMN IF EXISTS lease_owner;
-- ALTER TABLE device_commands DROP COLUMN IF EXISTS lease_expires_at;
-- ALTER TABLE device_commands DROP COLUMN IF EXISTS claim_attempts;
-- ALTER TABLE device_commands DROP COLUMN IF EXISTS result_payload;
-- ALTER TABLE device_commands DROP COLUMN IF EXISTS error_message;
-- COMMIT;

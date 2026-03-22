-- Migration 112: Scheduled task notification settings
-- Adds per-task notification channel configuration for scheduler outcomes.

ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS notify_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notify_email_to TEXT,
  ADD COLUMN IF NOT EXISTS notify_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS notify_slack_webhook_url TEXT;


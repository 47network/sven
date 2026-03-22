-- Migration 108: Chat agent pause/resume state

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS agent_paused BOOLEAN NOT NULL DEFAULT FALSE;

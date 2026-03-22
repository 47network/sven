-- Migration 036: Per-session profile override for chat commands

ALTER TABLE session_settings
  ADD COLUMN IF NOT EXISTS profile_name TEXT
  CHECK (profile_name IN ('gaming', 'balanced', 'performance'));

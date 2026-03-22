-- Migration 046: Persist approval vote audit confirmation metadata

ALTER TABLE approval_votes
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS confirm_phrase TEXT;


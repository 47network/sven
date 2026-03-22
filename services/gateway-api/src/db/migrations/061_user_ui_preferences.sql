CREATE TABLE IF NOT EXISTS user_ui_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visual_mode TEXT NOT NULL DEFAULT 'cinematic',
  motion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  motion_level TEXT NOT NULL DEFAULT 'full',
  avatar_mode TEXT NOT NULL DEFAULT 'orb',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_ui_preferences
  ADD CONSTRAINT user_ui_preferences_visual_mode_chk
  CHECK (visual_mode IN ('classic', 'cinematic'));

ALTER TABLE user_ui_preferences
  ADD CONSTRAINT user_ui_preferences_motion_level_chk
  CHECK (motion_level IN ('off', 'reduced', 'full'));

ALTER TABLE user_ui_preferences
  ADD CONSTRAINT user_ui_preferences_avatar_mode_chk
  CHECK (avatar_mode IN ('orb', 'robot', 'human', 'animal'));

CREATE INDEX IF NOT EXISTS idx_user_ui_preferences_updated_at
  ON user_ui_preferences(updated_at DESC);

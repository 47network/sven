-- Rollback for 127_voice_continuous_conversation.sql

DROP INDEX IF EXISTS idx_voice_cont_sessions_active;
DROP INDEX IF EXISTS idx_voice_cont_sessions_org_chat_user;
DROP TABLE IF EXISTS voice_continuous_sessions;

DELETE FROM settings_global
WHERE key IN (
  'voice.continuousConversation.enabled',
  'voice.continuousConversation.ttlSeconds'
);

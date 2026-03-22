-- Rollback for 129_voice_emotion_detection.sql

DROP INDEX IF EXISTS idx_voice_emotion_label_created;
DROP INDEX IF EXISTS idx_voice_emotion_chat_created;
DROP TABLE IF EXISTS voice_emotion_signals;

DELETE FROM settings_global
WHERE key IN (
  'voice.emotionDetection.enabled',
  'voice.emotionDetection.adjustTone'
);

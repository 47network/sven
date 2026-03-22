-- Rollback for 128_voice_speaker_identification.sql

DROP INDEX IF EXISTS idx_voice_speaker_profiles_lookup;
DROP INDEX IF EXISTS idx_voice_speaker_profiles_unique;
DROP TABLE IF EXISTS voice_speaker_profiles;

DELETE FROM settings_global
WHERE key IN ('voice.speakerIdentification.enabled');

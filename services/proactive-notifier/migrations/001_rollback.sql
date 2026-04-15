-- Rollback: 001_create_proactive_notifier_tables.sql

BEGIN;
DROP TABLE IF EXISTS proactive_notification_log CASCADE;
DROP TABLE IF EXISTS proactive_channel_endpoints CASCADE;
DROP TABLE IF EXISTS proactive_trigger_rules CASCADE;
COMMIT;

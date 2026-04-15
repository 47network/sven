-- Rollback: 001_create_marketing_intel_tables.sql
BEGIN;
DROP TABLE IF EXISTS marketing_analytics CASCADE;
DROP TABLE IF EXISTS marketing_coaching_sessions CASCADE;
DROP TABLE IF EXISTS marketing_campaigns CASCADE;
DROP TABLE IF EXISTS marketing_content CASCADE;
DROP TABLE IF EXISTS marketing_brand_checks CASCADE;
DROP TABLE IF EXISTS marketing_reports CASCADE;
DROP TABLE IF EXISTS marketing_signals CASCADE;
DROP TABLE IF EXISTS marketing_competitors CASCADE;
COMMIT;

-- Rollback 001: Drop all security toolkit tables

BEGIN;

DROP TABLE IF EXISTS suppression_rules CASCADE;
DROP TABLE IF EXISTS pentest_runs CASCADE;
DROP TABLE IF EXISTS security_postures CASCADE;
DROP TABLE IF EXISTS security_findings CASCADE;
DROP TABLE IF EXISTS security_scans CASCADE;

COMMIT;

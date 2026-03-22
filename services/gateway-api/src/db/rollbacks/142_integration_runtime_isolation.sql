-- Rollback for 142_integration_runtime_isolation.sql
BEGIN;
DROP TABLE IF EXISTS integration_runtime_secret_refs;
DROP TABLE IF EXISTS integration_runtime_configs;
DROP TABLE IF EXISTS integration_runtime_instances;
COMMIT;

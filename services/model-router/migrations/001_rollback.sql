-- Rollback 001: Drop model router tables
BEGIN;
DROP TABLE IF EXISTS benchmark_runs CASCADE;
DROP TABLE IF EXISTS routing_decisions CASCADE;
DROP TABLE IF EXISTS fleet_probes CASCADE;
DROP TABLE IF EXISTS fleet_nodes CASCADE;
DROP TABLE IF EXISTS model_registry CASCADE;
COMMIT;

-- Rollback for 20260417110000_a2a_audit_log.sql
-- Drops the a2a_audit_log table and its indexes.
-- NOTE: this is a destructive rollback — audit rows will be permanently lost.

DROP INDEX IF EXISTS idx_a2a_audit_log_status_time;
DROP INDEX IF EXISTS idx_a2a_audit_log_request;
DROP INDEX IF EXISTS idx_a2a_audit_log_trace;
DROP INDEX IF EXISTS idx_a2a_audit_log_org_time;
DROP TABLE IF EXISTS a2a_audit_log;

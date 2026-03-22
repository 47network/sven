-- Rollback for 052_mcp_overrides_and_tools.sql
-- Forward-only migration fallback: no destructive SQL by default.
-- If hard rollback is required, use docs/db/migration-rollback-plan.md and backup restore runbook.
BEGIN;
-- NO-OP rollback placeholder.
COMMIT;


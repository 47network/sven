-- Rollback for 20260411100003_rollback_tool.sql
-- Forward-only migration fallback: no destructive SQL by default.
-- If hard rollback is required, use docs/db/migration-rollback-plan.md and backup restore runbook.
BEGIN;
-- NO-OP rollback placeholder.
COMMIT;

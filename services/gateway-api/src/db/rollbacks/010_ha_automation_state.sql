-- Rollback for 010_ha_automation_state.sql
-- Forward-only migration fallback: no destructive SQL by default.
-- If hard rollback is required, use docs/db/migration-rollback-plan.md and backup restore runbook.
BEGIN;
-- NO-OP rollback placeholder.
COMMIT;


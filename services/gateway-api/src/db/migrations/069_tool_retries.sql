-- Migration: 069_tool_retries.sql
-- Self-Correcting Agent Loop — audit table for tool retry attempts
-- Part of A1: Self-Correcting Agent Loop (P0)

CREATE TABLE IF NOT EXISTS tool_retries (
    id                  TEXT PRIMARY KEY,
    tool_call_id        TEXT NOT NULL,
    attempt             INT NOT NULL DEFAULT 1,
    error_classification TEXT NOT NULL
        CHECK (error_classification IN ('transient', 'strategy', 'fatal')),
    error_detail        TEXT,
    original_params     JSONB NOT NULL DEFAULT '{}'::jsonb,
    corrected_params    JSONB,
    error_analysis      TEXT,
    outcome             TEXT NOT NULL DEFAULT 'pending'
        CHECK (outcome IN ('pending', 'success', 'failed', 'aborted')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying retries by original tool call
CREATE INDEX IF NOT EXISTS idx_tool_retries_tool_call_id ON tool_retries (tool_call_id);

-- Index for metrics and dashboard queries
CREATE INDEX IF NOT EXISTS idx_tool_retries_classification ON tool_retries (error_classification, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_retries_outcome ON tool_retries (outcome, created_at);

-- Add 'completed' to tool_runs status check if not already present
-- (The existing CHECK allows: running, success, error, timeout, denied)
-- We need 'completed' which is already used by skill-runner but may not be in the constraint
DO $$
BEGIN
    -- Check if completed is already in the constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tool_runs_status_check'
        AND conrelid = 'tool_runs'::regclass
        AND pg_get_constraintdef(oid) LIKE '%completed%'
    ) THEN
        ALTER TABLE tool_runs DROP CONSTRAINT IF EXISTS tool_runs_status_check;
        ALTER TABLE tool_runs ADD CONSTRAINT tool_runs_status_check
            CHECK (status IN ('running', 'success', 'error', 'timeout', 'denied', 'completed'));
    END IF;
END
$$;

COMMENT ON TABLE tool_retries IS 'Audit trail for self-correcting agent loop retry attempts';
COMMENT ON COLUMN tool_retries.tool_call_id IS 'References the original tool_runs.id that failed';
COMMENT ON COLUMN tool_retries.error_classification IS 'transient=retry same, strategy=try different, fatal=abort';
COMMENT ON COLUMN tool_retries.corrected_params IS 'For strategy retries: the new parameters suggested by LLM';
COMMENT ON COLUMN tool_retries.error_analysis IS 'Agent reasoning about why the tool failed (strategy only)';

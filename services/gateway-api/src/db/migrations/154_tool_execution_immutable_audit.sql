-- tool_execution_audit_log is append-only
-- Immutable audit trail for all tool execution events

CREATE TABLE IF NOT EXISTS tool_execution_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  tool_run_id   UUID NOT NULL,
  org_id        UUID NOT NULL,
  user_id       UUID NOT NULL,
  tool_name     TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  latest_hash   TEXT NOT NULL DEFAULT '',
  entry_hash TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Compute entry_hash on insert
CREATE OR REPLACE FUNCTION fn_tool_execution_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
  entry_hash_value TEXT;
BEGIN
  entry_hash_value := encode(digest(payload || latest_hash, 'sha256'), 'hex');
  NEW.entry_hash := entry_hash_value;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tool_runs_audit_append
  BEFORE INSERT ON tool_execution_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_tool_execution_audit_hash();

-- Prevent updates to maintain immutability
CREATE OR REPLACE FUNCTION fn_prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'tool_execution_audit_log is append-only: % not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tool_execution_audit_prevent_update
  BEFORE UPDATE ON tool_execution_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_audit_mutation();

CREATE TRIGGER trg_tool_execution_audit_prevent_delete
  BEFORE DELETE ON tool_execution_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_audit_mutation();

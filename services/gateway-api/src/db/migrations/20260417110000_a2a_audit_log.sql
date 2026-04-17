-- Migration 20260417110000: a2a_audit_log table for A2A protocol audit trail
-- This table backs the writeA2aAudit() writer in services/gateway-api/src/routes/a2a.ts.
-- Every A2A POST /v1/a2a request (status / echo / tools.list / forward) writes an immutable
-- audit row here with redacted request/response payloads, trace IDs, peer URL (for forward),
-- error code/message, and actor organization_id. Used for compliance (SOC 2 audit trail,
-- GDPR access logging) and incident forensics on cross-agent traffic.

CREATE TABLE IF NOT EXISTS a2a_audit_log (
    id                 TEXT PRIMARY KEY,
    organization_id    TEXT,
    request_id         TEXT,
    action             TEXT NOT NULL,
    direction          TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    status             TEXT NOT NULL CHECK (status IN ('success', 'error')),
    trace_id           TEXT,
    upstream_trace_id  TEXT,
    peer_url           TEXT,
    request_payload    JSONB,
    response_payload   JSONB,
    error_code         TEXT,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a2a_audit_log_org_time
  ON a2a_audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_a2a_audit_log_trace
  ON a2a_audit_log (trace_id)
  WHERE trace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_a2a_audit_log_request
  ON a2a_audit_log (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_a2a_audit_log_status_time
  ON a2a_audit_log (status, created_at DESC);

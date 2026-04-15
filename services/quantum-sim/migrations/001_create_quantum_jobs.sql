-- Quantum Sim service: job persistence
-- Migration 001: Create quantum_jobs table

BEGIN;

CREATE TABLE IF NOT EXISTS quantum_jobs (
  id            TEXT        PRIMARY KEY,
  backend_id    TEXT        NOT NULL DEFAULT 'local-sim',
  status        TEXT        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued','running','completed','failed','cancelled')),
  circuit_json  JSONB       NOT NULL,
  shots         INTEGER     NOT NULL DEFAULT 1024,
  result_json   JSONB,
  measurements  JSONB,
  estimated_cost JSONB,
  error         TEXT,
  org_id        TEXT        NOT NULL DEFAULT 'default',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quantum_jobs_status ON quantum_jobs (status);
CREATE INDEX IF NOT EXISTS idx_quantum_jobs_org    ON quantum_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_quantum_jobs_backend ON quantum_jobs (backend_id);

COMMIT;

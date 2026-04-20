-- Batch 134 — Agent Audit Trail
BEGIN;

CREATE TABLE IF NOT EXISTS audit_trail_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action          TEXT NOT NULL CHECK (action IN ('create','update','delete','access','execute','approve','reject','escalate')),
  scope           TEXT NOT NULL CHECK (scope IN ('agent','service','task','config','deployment','user','system')),
  actor_id        UUID,
  actor_type      TEXT NOT NULL DEFAULT 'agent',
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('full','incremental','diff')),
  scope           TEXT NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}',
  entry_count     INTEGER NOT NULL DEFAULT 0,
  compressed      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL,
  retention_days  INTEGER NOT NULL DEFAULT 365,
  archive_after   INTEGER DEFAULT 90,
  compress_after  INTEGER DEFAULT 30,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail_entries(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_scope ON audit_trail_entries(scope);
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor ON audit_trail_entries(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_resource ON audit_trail_entries(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created ON audit_trail_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_snapshots_type ON audit_snapshots(snapshot_type);

COMMIT;

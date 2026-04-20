-- Batch 135 — Agent Change Management
BEGIN;

CREATE TABLE IF NOT EXISTS change_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  request_type    TEXT NOT NULL CHECK (request_type IN ('feature','bugfix','hotfix','config','infrastructure','security')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','in_progress','completed','rolled_back','cancelled')),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  requester_id    UUID,
  assignee_id     UUID,
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  impact_analysis JSONB NOT NULL DEFAULT '{}',
  rollback_plan   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  submitted_at    TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_approvals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  change_id       UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  approver_id     UUID NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('approved','rejected','needs_info')),
  comments        TEXT,
  conditions      JSONB NOT NULL DEFAULT '{}',
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_rollbacks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  change_id       UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  rollback_type   TEXT NOT NULL CHECK (rollback_type IN ('full','partial','config_only')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  steps_completed JSONB NOT NULL DEFAULT '[]',
  initiated_by    UUID,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_type ON change_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_approvals_change ON change_approvals(change_id);
CREATE INDEX IF NOT EXISTS idx_change_rollbacks_change ON change_rollbacks(change_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_created ON change_requests(created_at);

COMMIT;

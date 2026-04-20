-- Migration: Create pillar expansion tables
-- Supports: Design (P1), Model Router (P2), Documents (P3), Quantum (P4),
--           Security (P5), Marketing (P7), Compute Mesh (P8)

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 1 — Design Intelligence
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS design_audits (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL DEFAULT 'full',
  findings    JSONB NOT NULL DEFAULT '{}',
  score       REAL NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_design_audits_org ON design_audits(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 2 — Multi-Model & AI Agency
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_instances (
  id             UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  definition_id  TEXT NOT NULL,
  personality    TEXT NOT NULL DEFAULT 'default',
  goals          JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_instances_org ON agent_instances(org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS model_benchmark_runs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suite_id    TEXT NOT NULL,
  results     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_benchmarks_org ON model_benchmark_runs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 3 — OCR & Document Intelligence
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS document_jobs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  filename    TEXT NOT NULL DEFAULT 'inline',
  status      TEXT NOT NULL DEFAULT 'completed',
  result      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_jobs_org ON document_jobs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 4 — Quantum Computing Simulation
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quantum_jobs (
  id          UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  config      JSONB NOT NULL DEFAULT '{}',
  result      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quantum_jobs_org ON quantum_jobs(org_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Pillar 5 — Security Toolkit
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS security_scans (
  id              UUID PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  target          TEXT NOT NULL DEFAULT '',
  finding_count   INTEGER NOT NULL DEFAULT 0,
  severity_high   INTEGER NOT NULL DEFAULT 0,
  severity_medium INTEGER NOT NULL DEFAULT 0,
  severity_low    INTEGER NOT NULL DEFAULT 0,
  findings        JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_scans_org ON security_scans(org_id, type, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════

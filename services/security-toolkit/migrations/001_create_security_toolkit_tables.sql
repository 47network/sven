-- Migration 001: Security Toolkit Service Tables
-- Stores security scan results, findings, posture snapshots, and pentest runs.

BEGIN;

-- ── security_scans: Top-level scan records ────────────────────────────
CREATE TABLE IF NOT EXISTS security_scans (
    id            UUID PRIMARY KEY,
    org_id        TEXT NOT NULL,
    user_id       TEXT,
    scan_type     TEXT NOT NULL CHECK (scan_type IN ('sast', 'dependency-audit', 'secret-scan', 'infra-audit', 'pentest', 'posture')),
    target        TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    findings_count INTEGER NOT NULL DEFAULT 0,
    severity_summary JSONB NOT NULL DEFAULT '{}',
    metadata      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_scans_org_id ON security_scans (org_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_type ON security_scans (org_id, scan_type);
CREATE INDEX IF NOT EXISTS idx_security_scans_created ON security_scans (created_at DESC);

-- ── security_findings: Individual findings from any scan type ─────────
CREATE TABLE IF NOT EXISTS security_findings (
    id            UUID PRIMARY KEY,
    scan_id       UUID NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
    org_id        TEXT NOT NULL,
    rule_id       TEXT NOT NULL,
    category      TEXT NOT NULL,
    severity      TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    file_path     TEXT,
    line_number   INTEGER,
    matched_text  TEXT,
    remediation   TEXT NOT NULL DEFAULT '',
    cwe_id        TEXT,
    owasp_ref     TEXT,
    suppressed    BOOLEAN NOT NULL DEFAULT FALSE,
    suppressed_by TEXT,
    suppressed_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_findings_scan ON security_findings (scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_org ON security_findings (org_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_severity ON security_findings (org_id, severity);
CREATE INDEX IF NOT EXISTS idx_security_findings_category ON security_findings (org_id, category);

-- ── security_postures: Point-in-time security posture snapshots ───────
CREATE TABLE IF NOT EXISTS security_postures (
    id               UUID PRIMARY KEY,
    org_id           TEXT NOT NULL,
    overall_score    INTEGER NOT NULL,
    grade            TEXT NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
    scores           JSONB NOT NULL DEFAULT '{}',
    critical_count   INTEGER NOT NULL DEFAULT 0,
    high_count       INTEGER NOT NULL DEFAULT 0,
    medium_count     INTEGER NOT NULL DEFAULT 0,
    low_count        INTEGER NOT NULL DEFAULT 0,
    total_findings   INTEGER NOT NULL DEFAULT 0,
    secrets_clean    BOOLEAN NOT NULL DEFAULT TRUE,
    top_risks        JSONB NOT NULL DEFAULT '[]',
    recommendations  JSONB NOT NULL DEFAULT '[]',
    compliance_notes JSONB NOT NULL DEFAULT '[]',
    scan_ids         UUID[] NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_postures_org ON security_postures (org_id);
CREATE INDEX IF NOT EXISTS idx_security_postures_created ON security_postures (org_id, created_at DESC);

-- ── pentest_runs: Penetration test execution records ──────────────────
CREATE TABLE IF NOT EXISTS pentest_runs (
    id             UUID PRIMARY KEY,
    org_id         TEXT NOT NULL,
    executed_by    TEXT NOT NULL,
    scenario_id    TEXT NOT NULL,
    scenario_name  TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error')),
    duration_ms    INTEGER,
    step_results   JSONB NOT NULL DEFAULT '[]',
    vulnerabilities JSONB NOT NULL DEFAULT '[]',
    summary        TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pentest_runs_org ON pentest_runs (org_id);
CREATE INDEX IF NOT EXISTS idx_pentest_runs_scenario ON pentest_runs (org_id, scenario_id);
CREATE INDEX IF NOT EXISTS idx_pentest_runs_status ON pentest_runs (org_id, status);

-- ── suppression_rules: Global and org-level finding suppressions ──────
CREATE TABLE IF NOT EXISTS suppression_rules (
    id             UUID PRIMARY KEY,
    org_id         TEXT NOT NULL,
    rule_id        TEXT NOT NULL,
    file_pattern   TEXT,
    justification  TEXT NOT NULL,
    created_by     TEXT NOT NULL,
    expires_at     TIMESTAMPTZ,
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppression_rules_org ON suppression_rules (org_id, active);
CREATE INDEX IF NOT EXISTS idx_suppression_rules_rule ON suppression_rules (org_id, rule_id);

COMMIT;

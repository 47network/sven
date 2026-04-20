-- Batch 50 — Agent SLA & Contracts
-- Service Level Agreements and formal contracts between agents

CREATE TABLE IF NOT EXISTS service_contracts (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT NOT NULL,
  consumer_id   TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'standard',
  title         TEXT NOT NULL,
  description   TEXT,
  terms         JSONB NOT NULL DEFAULT '{}',
  start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date      TIMESTAMPTZ,
  auto_renew    BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'draft',
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_definitions (
  id              TEXT PRIMARY KEY,
  contract_id     TEXT NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  metric_type     TEXT NOT NULL,
  target_value    NUMERIC NOT NULL,
  threshold_warn  NUMERIC,
  threshold_breach NUMERIC,
  measurement_window TEXT NOT NULL DEFAULT 'monthly',
  penalty_type    TEXT NOT NULL DEFAULT 'none',
  penalty_value   NUMERIC DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sla_measurements (
  id              TEXT PRIMARY KEY,
  sla_id          TEXT NOT NULL REFERENCES sla_definitions(id) ON DELETE CASCADE,
  measured_value  NUMERIC NOT NULL,
  target_value    NUMERIC NOT NULL,
  compliance      TEXT NOT NULL DEFAULT 'met',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  details         JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_amendments (
  id              TEXT PRIMARY KEY,
  contract_id     TEXT NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  amendment_type  TEXT NOT NULL DEFAULT 'modification',
  description     TEXT NOT NULL,
  old_terms       JSONB NOT NULL DEFAULT '{}',
  new_terms       JSONB NOT NULL DEFAULT '{}',
  proposed_by     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed',
  approved_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_disputes (
  id              TEXT PRIMARY KEY,
  contract_id     TEXT NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  sla_id          TEXT REFERENCES sla_definitions(id),
  raised_by       TEXT NOT NULL,
  dispute_type    TEXT NOT NULL DEFAULT 'sla_breach',
  severity        TEXT NOT NULL DEFAULT 'medium',
  description     TEXT NOT NULL,
  evidence        JSONB NOT NULL DEFAULT '[]',
  resolution      TEXT,
  resolved_by     TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- Indexes (15)
CREATE INDEX idx_service_contracts_provider ON service_contracts(provider_id);
CREATE INDEX idx_service_contracts_consumer ON service_contracts(consumer_id);
CREATE INDEX idx_service_contracts_status ON service_contracts(status);
CREATE INDEX idx_service_contracts_type ON service_contracts(contract_type);
CREATE INDEX idx_service_contracts_end_date ON service_contracts(end_date);
CREATE INDEX idx_sla_definitions_contract ON sla_definitions(contract_id);
CREATE INDEX idx_sla_definitions_metric ON sla_definitions(metric_type);
CREATE INDEX idx_sla_definitions_status ON sla_definitions(status);
CREATE INDEX idx_sla_measurements_sla ON sla_measurements(sla_id);
CREATE INDEX idx_sla_measurements_compliance ON sla_measurements(compliance);
CREATE INDEX idx_sla_measurements_period ON sla_measurements(period_start, period_end);
CREATE INDEX idx_contract_amendments_contract ON contract_amendments(contract_id);
CREATE INDEX idx_contract_amendments_status ON contract_amendments(status);
CREATE INDEX idx_contract_disputes_contract ON contract_disputes(contract_id);
CREATE INDEX idx_contract_disputes_status ON contract_disputes(status);

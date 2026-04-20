-- Batch 159: Agent Cost Allocation
-- Track and allocate infrastructure costs per agent, crew, and project

CREATE TABLE IF NOT EXISTS agent_cost_centers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  center_name     TEXT NOT NULL,
  center_type     TEXT NOT NULL CHECK (center_type IN ('agent','crew','project','department','service','infrastructure')),
  parent_id       UUID REFERENCES agent_cost_centers(id),
  budget_limit    NUMERIC(18,6),
  budget_period   TEXT NOT NULL DEFAULT 'monthly' CHECK (budget_period IN ('daily','weekly','monthly','quarterly','yearly')),
  currency        TEXT NOT NULL DEFAULT '47T',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_cost_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id       UUID NOT NULL REFERENCES agent_cost_centers(id),
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('compute','storage','network','api_call','model_inference','bandwidth','license','other')),
  amount          NUMERIC(18,6) NOT NULL,
  unit_count      NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit_price      NUMERIC(18,6) NOT NULL,
  description     TEXT,
  resource_id     TEXT,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_cost_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id       UUID NOT NULL REFERENCES agent_cost_centers(id),
  report_period   TEXT NOT NULL,
  total_cost      NUMERIC(18,6) NOT NULL DEFAULT 0,
  budget_used_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  top_categories  JSONB NOT NULL DEFAULT '[]',
  anomalies       JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_centers_tenant ON agent_cost_centers(tenant_id);
CREATE INDEX idx_cost_entries_center ON agent_cost_entries(center_id);
CREATE INDEX idx_cost_reports_center ON agent_cost_reports(center_id);

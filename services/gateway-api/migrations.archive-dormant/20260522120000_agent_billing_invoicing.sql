-- Batch 49 — Agent Billing & Invoicing
-- Automated billing cycles, invoice generation, payment tracking,
-- usage metering, and credit management for the autonomous economy.

CREATE TABLE IF NOT EXISTS billing_accounts (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL,
  account_type   TEXT NOT NULL DEFAULT 'standard',
  currency       TEXT NOT NULL DEFAULT 'USD',
  balance        NUMERIC(18,6) NOT NULL DEFAULT 0,
  credit_limit   NUMERIC(18,6) NOT NULL DEFAULT 0,
  billing_cycle  TEXT NOT NULL DEFAULT 'monthly',
  next_invoice   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active',
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES billing_accounts(id),
  invoice_number TEXT NOT NULL UNIQUE,
  period_start   TIMESTAMPTZ NOT NULL,
  period_end     TIMESTAMPTZ NOT NULL,
  subtotal       NUMERIC(18,6) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(18,6) NOT NULL DEFAULT 0,
  total          NUMERIC(18,6) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL DEFAULT 'draft',
  due_date       TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id             TEXT PRIMARY KEY,
  invoice_id     TEXT NOT NULL REFERENCES invoices(id),
  description    TEXT NOT NULL,
  quantity       NUMERIC(18,6) NOT NULL DEFAULT 1,
  unit_price     NUMERIC(18,6) NOT NULL DEFAULT 0,
  amount         NUMERIC(18,6) NOT NULL DEFAULT 0,
  category       TEXT NOT NULL DEFAULT 'service',
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_meters (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES billing_accounts(id),
  meter_type     TEXT NOT NULL,
  units_consumed NUMERIC(18,6) NOT NULL DEFAULT 0,
  unit_cost      NUMERIC(18,6) NOT NULL DEFAULT 0,
  period_start   TIMESTAMPTZ NOT NULL,
  period_end     TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active',
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES billing_accounts(id),
  amount         NUMERIC(18,6) NOT NULL,
  direction      TEXT NOT NULL,
  reason         TEXT NOT NULL,
  reference_id   TEXT,
  balance_after  NUMERIC(18,6) NOT NULL,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_accounts_agent ON billing_accounts(agent_id);
CREATE INDEX idx_billing_accounts_status ON billing_accounts(status);
CREATE INDEX idx_billing_accounts_next_invoice ON billing_accounts(next_invoice);
CREATE INDEX idx_invoices_account ON invoices(account_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_period ON invoices(period_start, period_end);
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_category ON invoice_line_items(category);
CREATE INDEX idx_usage_meters_account ON usage_meters(account_id);
CREATE INDEX idx_usage_meters_type ON usage_meters(meter_type);
CREATE INDEX idx_usage_meters_status ON usage_meters(status);
CREATE INDEX idx_usage_meters_period ON usage_meters(period_start, period_end);
CREATE INDEX idx_credit_transactions_account ON credit_transactions(account_id);
CREATE INDEX idx_credit_transactions_direction ON credit_transactions(direction);

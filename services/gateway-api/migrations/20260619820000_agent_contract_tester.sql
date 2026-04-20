-- Batch 345: Contract Tester
CREATE TABLE IF NOT EXISTS agent_contract_tester_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  test_framework TEXT DEFAULT 'pact',
  auto_verify BOOLEAN DEFAULT true,
  fail_on_breaking BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_contract_tester_configs(id),
  contract_name TEXT NOT NULL,
  provider_service TEXT NOT NULL,
  consumer_service TEXT NOT NULL,
  contract_spec JSONB NOT NULL,
  version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_contract_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES agent_contracts(id),
  test_run_id TEXT,
  passed BOOLEAN,
  breaking_changes JSONB DEFAULT '[]',
  compatibility_score NUMERIC(5,2),
  tested_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contracts_config ON agent_contracts(config_id);
CREATE INDEX idx_contract_results_contract ON agent_contract_results(contract_id);

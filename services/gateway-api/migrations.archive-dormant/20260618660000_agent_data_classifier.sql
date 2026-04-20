-- Batch 229: Data Classifier
-- Classifies and labels data for sensitivity and handling requirements

CREATE TABLE IF NOT EXISTS agent_data_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resource_type VARCHAR(128) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  classification VARCHAR(64) NOT NULL CHECK (classification IN ('public', 'internal', 'confidential', 'restricted', 'top_secret')),
  labels JSONB NOT NULL DEFAULT '[]',
  confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
  classified_by VARCHAR(64) NOT NULL DEFAULT 'auto',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  pattern JSONB NOT NULL,
  target_classification VARCHAR(64) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_data_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id UUID NOT NULL REFERENCES agent_data_classifications(id),
  source_system VARCHAR(255) NOT NULL,
  transformation VARCHAR(255),
  destination_system VARCHAR(255),
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_classifications_agent ON agent_data_classifications(agent_id);
CREATE INDEX idx_data_classifications_level ON agent_data_classifications(classification);
CREATE INDEX idx_classification_rules_agent ON agent_classification_rules(agent_id);
CREATE INDEX idx_data_lineage_classification ON agent_data_lineage(classification_id);

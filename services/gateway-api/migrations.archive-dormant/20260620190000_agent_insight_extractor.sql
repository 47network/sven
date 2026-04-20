CREATE TABLE IF NOT EXISTS agent_insight_extractor_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  extraction_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  confidence_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.800,
  max_insights_per_doc INTEGER NOT NULL DEFAULT 20,
  categorize_insights BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_extracted_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_insight_extractor_configs(id),
  agent_id UUID NOT NULL,
  source_document_id UUID,
  insight_text TEXT NOT NULL,
  insight_type TEXT NOT NULL DEFAULT 'finding',
  category TEXT,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  supporting_evidence TEXT,
  actionable BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_insight_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_insight_id UUID NOT NULL REFERENCES agent_extracted_insights(id),
  target_insight_id UUID NOT NULL REFERENCES agent_extracted_insights(id),
  connection_type TEXT NOT NULL DEFAULT 'related',
  strength NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extracted_insights_agent ON agent_extracted_insights(agent_id);
CREATE INDEX IF NOT EXISTS idx_extracted_insights_type ON agent_extracted_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insight_connections_source ON agent_insight_connections(source_insight_id);

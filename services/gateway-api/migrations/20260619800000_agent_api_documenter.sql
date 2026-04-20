-- Batch 343: API Documenter
CREATE TABLE IF NOT EXISTS agent_api_documenter_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT true,
  output_format TEXT DEFAULT 'openapi3',
  auto_generate BOOLEAN DEFAULT true,
  include_examples BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_api_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_api_documenter_configs(id),
  spec_name TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  spec_format TEXT DEFAULT 'openapi3',
  spec_content JSONB NOT NULL,
  endpoint_count INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID NOT NULL REFERENCES agent_api_specs(id),
  page_path TEXT NOT NULL,
  title TEXT,
  content TEXT,
  page_type TEXT DEFAULT 'endpoint',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_specs_config ON agent_api_specs(config_id);
CREATE INDEX idx_doc_pages_spec ON agent_doc_pages(spec_id);

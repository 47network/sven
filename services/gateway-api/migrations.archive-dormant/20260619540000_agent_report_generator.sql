-- Batch 317: Report Generator vertical
CREATE TABLE IF NOT EXISTS agent_report_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  output_format TEXT NOT NULL DEFAULT 'pdf' CHECK (output_format IN ('pdf','html','csv','xlsx','markdown','json')),
  template_engine TEXT NOT NULL DEFAULT 'handlebars',
  schedule_cron TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_report_configs(id),
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_report_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES agent_report_templates(id),
  output_url TEXT NOT NULL,
  output_format TEXT NOT NULL,
  page_count INTEGER,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_report_configs_agent ON agent_report_configs(agent_id);
CREATE INDEX idx_report_templates_config ON agent_report_templates(config_id);
CREATE INDEX idx_report_outputs_template ON agent_report_outputs(template_id);

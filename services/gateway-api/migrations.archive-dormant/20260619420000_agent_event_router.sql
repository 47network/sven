-- Batch 305: Event Router
CREATE TABLE IF NOT EXISTS agent_event_rtr_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID NOT NULL,
  routing_mode TEXT NOT NULL DEFAULT 'content_based', max_fanout INTEGER DEFAULT 10,
  dead_letter BOOLEAN DEFAULT true, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), config_id UUID NOT NULL REFERENCES agent_event_rtr_configs(id),
  rule_name TEXT NOT NULL, source_pattern TEXT NOT NULL, target_subjects TEXT[] NOT NULL,
  filter_expression JSONB DEFAULT '{}', priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_routed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rule_id UUID NOT NULL REFERENCES agent_routing_rules(id),
  source_subject TEXT NOT NULL, target_subject TEXT NOT NULL,
  payload_size_bytes INTEGER DEFAULT 0, latency_ms DOUBLE PRECISION DEFAULT 0,
  success BOOLEAN DEFAULT true, routed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_event_rtr_configs_agent ON agent_event_rtr_configs(agent_id);
CREATE INDEX idx_routing_rules_config ON agent_routing_rules(config_id);
CREATE INDEX idx_routed_events_rule ON agent_routed_events(rule_id);

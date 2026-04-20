CREATE TABLE IF NOT EXISTS agent_taxonomy_builder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  max_depth INTEGER NOT NULL DEFAULT 10,
  auto_classify BOOLEAN NOT NULL DEFAULT true,
  merge_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.850,
  language TEXT NOT NULL DEFAULT 'en',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_taxonomy_builder_configs(id),
  parent_id UUID REFERENCES agent_taxonomy_nodes(id),
  node_name TEXT NOT NULL,
  node_slug TEXT NOT NULL,
  description TEXT,
  depth_level INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_taxonomy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES agent_taxonomy_nodes(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  assigned_by TEXT NOT NULL DEFAULT 'auto',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_config ON agent_taxonomy_nodes(config_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_parent ON agent_taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_assignments_node ON agent_taxonomy_assignments(node_id);

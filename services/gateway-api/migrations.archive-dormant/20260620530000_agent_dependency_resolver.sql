-- Batch 416: Dependency Resolver
CREATE TABLE IF NOT EXISTS agent_dependency_resolver_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resolution_strategy TEXT NOT NULL DEFAULT 'semver' CHECK (resolution_strategy IN ('semver','exact','latest','minimal')),
  allow_prerelease BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dependency_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_dependency_resolver_configs(id),
  name TEXT NOT NULL,
  root_package TEXT NOT NULL,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dependency_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES agent_dependency_graphs(id),
  package_name TEXT NOT NULL,
  required_versions TEXT[] NOT NULL,
  resolved_version TEXT,
  resolution_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dep_resolver_configs_agent ON agent_dependency_resolver_configs(agent_id);
CREATE INDEX idx_dep_graphs_config ON agent_dependency_graphs(config_id);
CREATE INDEX idx_dep_conflicts_graph ON agent_dependency_conflicts(graph_id);

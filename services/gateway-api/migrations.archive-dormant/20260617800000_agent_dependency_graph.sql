-- Batch 143: Agent Dependency Graph
-- Tracks dependency relationships between agents, services, and resources

CREATE TABLE IF NOT EXISTS dependency_graphs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  name            TEXT NOT NULL,
  graph_kind      TEXT NOT NULL CHECK (graph_kind IN ('service','data','task','resource','agent')),
  root_node_id    UUID,
  node_count      INTEGER NOT NULL DEFAULT 0,
  edge_count      INTEGER NOT NULL DEFAULT 0,
  is_acyclic      BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dependency_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id        UUID NOT NULL REFERENCES dependency_graphs(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  node_type       TEXT NOT NULL CHECK (node_type IN ('service','database','api','queue','agent','file','package')),
  version         TEXT,
  depth           INTEGER NOT NULL DEFAULT 0,
  in_degree       INTEGER NOT NULL DEFAULT 0,
  out_degree      INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dependency_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id        UUID NOT NULL REFERENCES dependency_graphs(id) ON DELETE CASCADE,
  source_node_id  UUID NOT NULL REFERENCES dependency_nodes(id) ON DELETE CASCADE,
  target_node_id  UUID NOT NULL REFERENCES dependency_nodes(id) ON DELETE CASCADE,
  edge_type       TEXT NOT NULL CHECK (edge_type IN ('depends_on','imports','calls','reads','writes','produces','consumes')),
  weight          REAL NOT NULL DEFAULT 1.0,
  is_critical     BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(graph_id, source_node_id, target_node_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_dep_graphs_agent ON dependency_graphs(agent_id);
CREATE INDEX IF NOT EXISTS idx_dep_graphs_kind ON dependency_graphs(graph_kind);
CREATE INDEX IF NOT EXISTS idx_dep_nodes_graph ON dependency_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_dep_nodes_type ON dependency_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_dep_edges_source ON dependency_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_dep_edges_target ON dependency_edges(target_node_id);

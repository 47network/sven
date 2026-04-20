-- Agent Topology Map migration
-- Batch 168: network topology discovery and visualization

CREATE TABLE IF NOT EXISTS agent_topology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('service','database','cache','queue','gateway','external','storage','compute')),
  node_name VARCHAR(255) NOT NULL,
  host VARCHAR(255),
  port INTEGER,
  protocol VARCHAR(50),
  health_status VARCHAR(30) DEFAULT 'unknown' CHECK (health_status IN ('healthy','degraded','down','unknown')),
  metadata JSONB DEFAULT '{}',
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_topology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES agent_topology_nodes(id),
  target_node_id UUID NOT NULL REFERENCES agent_topology_nodes(id),
  edge_type VARCHAR(50) NOT NULL CHECK (edge_type IN ('http','grpc','tcp','udp','websocket','nats','redis','postgres')),
  latency_ms NUMERIC(10,2),
  bandwidth_mbps NUMERIC(10,2),
  encrypted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_topology_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_name VARCHAR(255) NOT NULL,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  topology_data JSONB NOT NULL,
  diff_from_previous JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topology_nodes_agent ON agent_topology_nodes(agent_id);
CREATE INDEX idx_topology_nodes_type ON agent_topology_nodes(node_type);
CREATE INDEX idx_topology_edges_source ON agent_topology_edges(source_node_id);
CREATE INDEX idx_topology_edges_target ON agent_topology_edges(target_node_id);
CREATE INDEX idx_topology_snapshots_created ON agent_topology_snapshots(created_at);

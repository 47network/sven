-- Batch 148: Agent Mesh Routing
-- Intelligent message/task routing across agent mesh networks

CREATE TABLE IF NOT EXISTS mesh_route_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  policy TEXT NOT NULL DEFAULT 'round_robin' CHECK (policy IN ('round_robin','weighted','latency','priority','failover','broadcast')),
  active BOOLEAN NOT NULL DEFAULT true,
  route_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mesh_route_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES mesh_route_tables(id) ON DELETE CASCADE,
  destination_agent_id UUID NOT NULL,
  pattern TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 100,
  priority INTEGER NOT NULL DEFAULT 0,
  healthy BOOLEAN NOT NULL DEFAULT true,
  latency_ms REAL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mesh_route_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES mesh_route_tables(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES mesh_route_entries(id) ON DELETE SET NULL,
  source_agent_id UUID NOT NULL,
  destination_agent_id UUID,
  pattern TEXT NOT NULL,
  routed BOOLEAN NOT NULL DEFAULT false,
  latency_ms REAL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mesh_route_tables_agent ON mesh_route_tables(agent_id);
CREATE INDEX idx_mesh_route_tables_active ON mesh_route_tables(active) WHERE active = true;
CREATE INDEX idx_mesh_route_entries_table ON mesh_route_entries(table_id);
CREATE INDEX idx_mesh_route_entries_dest ON mesh_route_entries(destination_agent_id);
CREATE INDEX idx_mesh_route_logs_table ON mesh_route_logs(table_id);
CREATE INDEX idx_mesh_route_logs_created ON mesh_route_logs(created_at);

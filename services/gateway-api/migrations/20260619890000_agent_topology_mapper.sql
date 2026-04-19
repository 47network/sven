-- Batch 352: Topology Mapper — service topology discovery and dependency mapping
CREATE TABLE IF NOT EXISTS agent_topology_mapper_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    map_name VARCHAR(255) NOT NULL,
    discovery_method VARCHAR(50) DEFAULT 'active',
    scan_interval_seconds INTEGER DEFAULT 300,
    include_external BOOLEAN DEFAULT false,
    depth_limit INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_topology_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_topology_mapper_configs(id),
    node_name VARCHAR(255) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    address VARCHAR(500),
    port INTEGER,
    health_status VARCHAR(20) DEFAULT 'unknown',
    metadata JSONB DEFAULT '{}'::jsonb,
    discovered_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_topology_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES agent_topology_mapper_configs(id),
    source_node_id UUID NOT NULL REFERENCES agent_topology_nodes(id),
    target_node_id UUID NOT NULL REFERENCES agent_topology_nodes(id),
    edge_type VARCHAR(50) DEFAULT 'dependency',
    protocol VARCHAR(50),
    latency_ms NUMERIC(10,2),
    request_rate NUMERIC(10,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    discovered_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_topology_mapper_agent ON agent_topology_mapper_configs(agent_id);
CREATE INDEX idx_topology_nodes_config ON agent_topology_nodes(config_id);
CREATE INDEX idx_topology_edges_config ON agent_topology_edges(config_id);
CREATE INDEX idx_topology_edges_source ON agent_topology_edges(source_node_id);

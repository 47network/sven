-- Batch 250: IP Allocator
CREATE TABLE IF NOT EXISTS agent_ip_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  pool_name TEXT NOT NULL,
  cidr_block TEXT NOT NULL,
  gateway TEXT,
  vlan_id INTEGER,
  ip_version INTEGER NOT NULL DEFAULT 4 CHECK (ip_version IN (4, 6)),
  total_addresses INTEGER NOT NULL,
  allocated_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'reserved', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ip_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES agent_ip_pools(id),
  ip_address INET NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('static', 'dynamic', 'reserved', 'floating')),
  assigned_to TEXT,
  hostname TEXT,
  mac_address TEXT,
  lease_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'released', 'reserved', 'conflict')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ip_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES agent_ip_pools(id),
  action TEXT NOT NULL CHECK (action IN ('allocate', 'release', 'reserve', 'conflict_detected', 'pool_expanded')),
  ip_address INET,
  performed_by TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ip_pools_agent ON agent_ip_pools(agent_id);
CREATE INDEX idx_ip_allocations_pool ON agent_ip_allocations(pool_id);
CREATE INDEX idx_ip_allocations_address ON agent_ip_allocations(ip_address);

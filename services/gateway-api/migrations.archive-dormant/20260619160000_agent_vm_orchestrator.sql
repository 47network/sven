-- Batch 279: VM Orchestrator
CREATE TABLE IF NOT EXISTS agent_vm_orch_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  hypervisor TEXT NOT NULL DEFAULT 'proxmox',
  cluster_id TEXT,
  default_template TEXT,
  network_config JSONB DEFAULT '{}',
  max_vms INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_vm_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_vm_orch_configs(id),
  vm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template TEXT,
  cpu_cores INTEGER DEFAULT 1,
  memory_mb INTEGER DEFAULT 1024,
  disk_gb INTEGER DEFAULT 20,
  ip_address TEXT,
  state TEXT NOT NULL DEFAULT 'creating',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  destroyed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS agent_vm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES agent_vm_instances(id),
  snapshot_name TEXT NOT NULL,
  size_mb INTEGER DEFAULT 0,
  parent_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vm_orch_configs_agent ON agent_vm_orch_configs(agent_id);
CREATE INDEX idx_vm_instances_config ON agent_vm_instances(config_id);
CREATE INDEX idx_vm_snapshots_instance ON agent_vm_snapshots(instance_id);

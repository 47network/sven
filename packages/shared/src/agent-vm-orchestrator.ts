export type HypervisorType = 'proxmox' | 'vmware' | 'kvm' | 'hyper_v' | 'xen';
export type VmState = 'creating' | 'running' | 'paused' | 'stopped' | 'migrating' | 'error' | 'destroyed';

export interface AgentVmOrchConfig {
  id: string; agent_id: string; hypervisor: HypervisorType; cluster_id: string;
  default_template: string; network_config: Record<string, unknown>;
  max_vms: number; status: string; created_at: string; updated_at: string;
}
export interface AgentVmInstance {
  id: string; config_id: string; vm_id: string; name: string; template: string;
  cpu_cores: number; memory_mb: number; disk_gb: number; ip_address: string;
  state: VmState; created_at: string; destroyed_at: string | null;
}
export interface AgentVmSnapshot {
  id: string; instance_id: string; snapshot_name: string;
  size_mb: number; parent_snapshot: string; created_at: string;
}

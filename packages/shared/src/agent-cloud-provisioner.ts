export type CloudProvider = 'proxmox' | 'aws' | 'gcp' | 'azure' | 'hetzner' | 'bare_metal';
export type ResourceType = 'vm' | 'container' | 'storage' | 'network' | 'load_balancer' | 'dns_record';
export type ResourceState = 'provisioning' | 'running' | 'stopped' | 'error' | 'destroying' | 'destroyed';

export interface AgentCloudProvConfig {
  id: string; agent_id: string; provider: CloudProvider; region: string;
  credentials_ref: string; resource_quotas: Record<string, number>;
  auto_scale: boolean; cost_limit_cents: number; status: string;
  created_at: string; updated_at: string;
}
export interface AgentCloudProvResource {
  id: string; config_id: string; resource_type: ResourceType; resource_id: string;
  name: string; specs: Record<string, unknown>; state: ResourceState;
  cost_per_hour_cents: number; provisioned_at: string; destroyed_at: string | null;
}
export interface AgentCloudProvEvent {
  id: string; resource_id: string; event_type: string;
  details: Record<string, unknown>; created_at: string;
}

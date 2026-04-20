export type VlanPortType = 'access' | 'trunk' | 'hybrid';
export type VlanAclDirection = 'inbound' | 'outbound' | 'both';
export type VlanAclAction = 'permit' | 'deny' | 'log';

export interface AgentVlanConfig {
  id: string;
  agent_id: string;
  vlan_id: number;
  vlan_name: string;
  subnet_cidr: string | null;
  gateway_ip: string | null;
  dhcp_enabled: boolean;
  mtu: number;
  tagged: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentVlanPort {
  id: string;
  vlan_config_id: string;
  port_name: string;
  port_type: VlanPortType;
  native_vlan: boolean;
  status: string;
  mac_count: number;
  created_at: string;
}

export interface AgentVlanAcl {
  id: string;
  vlan_config_id: string;
  acl_name: string;
  direction: VlanAclDirection;
  action: VlanAclAction;
  source_cidr: string | null;
  dest_cidr: string | null;
  protocol: string | null;
  port_range: string | null;
  priority: number;
  created_at: string;
}

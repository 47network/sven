export type NatType = 'snat' | 'dnat' | 'masquerade' | 'redirect' | 'double_nat';
export type NatRuleType = 'snat' | 'dnat' | 'port_forward' | 'hairpin';
export type NatGatewayStatus = 'active' | 'inactive' | 'failed' | 'maintenance';

export interface AgentNatConfig {
  id: string;
  agent_id: string;
  gateway_name: string;
  nat_type: NatType;
  external_ip: string | null;
  internal_cidr: string | null;
  masquerade: boolean;
  status: NatGatewayStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentNatRule {
  id: string;
  config_id: string;
  rule_type: NatRuleType;
  source_cidr: string | null;
  destination_cidr: string | null;
  translated_ip: string | null;
  translated_port: number | null;
  protocol: string;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface AgentNatTranslation {
  id: string;
  config_id: string;
  original_ip: string;
  translated_ip: string;
  original_port: number | null;
  translated_port: number | null;
  protocol: string | null;
  packets_count: number;
  bytes_count: number;
  created_at: string;
}

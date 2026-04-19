// Batch 184: Agent Firewall Controller — firewall rules, security groups, threat blocking

export type FirewallRulesetStatus = 'active' | 'disabled' | 'testing' | 'archived';

export type FirewallDefaultAction = 'allow' | 'deny' | 'log';

export type FirewallDirection = 'inbound' | 'outbound' | 'both';

export type FirewallProtocol = 'tcp' | 'udp' | 'icmp' | 'any';

export type FirewallRuleAction = 'allow' | 'deny' | 'log' | 'rate_limit';

export type FirewallThreatType = 'brute_force' | 'port_scan' | 'ddos' | 'intrusion' | 'malware' | 'unknown';

export type FirewallActionTaken = 'blocked' | 'allowed' | 'rate_limited' | 'logged' | 'quarantined';

export interface FirewallRuleset {
  id: string;
  agent_id: string;
  ruleset_name: string;
  description: string | null;
  target_zone: string;
  priority: number;
  default_action: FirewallDefaultAction;
  rule_count: number;
  status: FirewallRulesetStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FirewallRule {
  id: string;
  ruleset_id: string;
  rule_name: string;
  direction: FirewallDirection;
  protocol: FirewallProtocol;
  source_cidr: string | null;
  destination_cidr: string | null;
  port_range: string | null;
  action: FirewallRuleAction;
  priority: number;
  hit_count: number;
  last_hit_at: string | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FirewallThreat {
  id: string;
  ruleset_id: string;
  threat_type: FirewallThreatType;
  source_ip: string;
  target_ip: string | null;
  target_port: number | null;
  severity: string;
  action_taken: FirewallActionTaken;
  details: Record<string, unknown>;
  detected_at: string;
  resolved_at: string | null;
}

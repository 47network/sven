export type PolicyEngine = 'opa' | 'cedar' | 'casbin' | 'custom';
export type EnforcementMode = 'enforce' | 'audit' | 'disabled';
export interface AgentPolicyConfig {
  id: string; agent_id: string; policy_engine: PolicyEngine; enforcement_mode: EnforcementMode;
  audit_log: boolean; status: string; created_at: string; updated_at: string;
}
export interface AgentPolicy {
  id: string; config_id: string; policy_name: string; policy_type: string;
  rules: unknown[]; priority: number; active: boolean; created_at: string;
}
export interface AgentPolicyDecision {
  id: string; policy_id: string; action: string; resource: string; principal: string;
  allowed: boolean; reason: string; evaluated_at: string;
}

export type MeshType = 'istio' | 'linkerd' | 'consul' | 'envoy';
export type RouteStatus = 'active' | 'inactive' | 'draining';
export type MeshPolicyType = 'rate_limit' | 'auth' | 'cors' | 'header_transform';

export interface AgentSvcMeshConfig {
  id: string;
  agent_id: string;
  mesh_type: MeshType;
  mtls_enabled: boolean;
  tracing_enabled: boolean;
  retry_budget_pct: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentSvcMeshRoute {
  id: string;
  config_id: string;
  source_service: string;
  dest_service: string;
  weight: number;
  timeout_ms: number;
  retries: number;
  circuit_breaker: boolean;
  status: RouteStatus;
  created_at: string;
}

export interface AgentSvcMeshPolicy {
  id: string;
  config_id: string;
  policy_type: MeshPolicyType;
  target_service: string;
  rules: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

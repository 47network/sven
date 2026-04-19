export type MeshSidecarMode = 'automatic' | 'manual' | 'disabled';
export type MeshObservability = 'minimal' | 'standard' | 'full' | 'debug';
export type MeshProtocol = 'http' | 'http2' | 'grpc' | 'tcp' | 'tls';

export interface AgentMeshConfig {
  id: string;
  agent_id: string;
  mesh_name: string;
  namespace: string;
  mtls_enabled: boolean;
  sidecar_mode: MeshSidecarMode;
  observability_level: MeshObservability;
  retry_policy: Record<string, unknown>;
  circuit_breaker: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentMeshService {
  id: string;
  mesh_id: string;
  service_name: string;
  service_port: number;
  protocol: MeshProtocol;
  version: string;
  replicas: number;
  health_check_path: string;
  traffic_policy: Record<string, unknown>;
  created_at: string;
}

export interface AgentMeshTrafficRule {
  id: string;
  mesh_id: string;
  rule_name: string;
  source_service: string | null;
  destination_service: string;
  match_criteria: Record<string, unknown>;
  weight_percent: number;
  timeout_ms: number;
  retries: number;
  created_at: string;
}

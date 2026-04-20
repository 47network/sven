export type LbAlgorithm = 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'ip_hash' | 'random';
export type BackendStatus = 'healthy' | 'unhealthy' | 'draining' | 'disabled';

export interface AgentLbOrchestratorConfig {
  id: string;
  agentId: string;
  lbName: string;
  algorithm: LbAlgorithm;
  healthCheckPath: string;
  healthCheckInterval: number;
  stickySessions: boolean;
  maxBackends: number;
  metadata: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLbBackend {
  id: string;
  configId: string;
  backendUrl: string;
  weight: number;
  maxConnections: number;
  status: BackendStatus;
  lastHealthCheck: string | null;
  requestCount: number;
  errorCount: number;
  createdAt: string;
}

export interface AgentLbRule {
  id: string;
  configId: string;
  ruleName: string;
  matchPath: string | null;
  matchHeader: string | null;
  targetBackendId: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

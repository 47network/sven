export type OrchestratorPlatform = 'kubernetes' | 'docker_swarm' | 'nomad' | 'compose';
export type DeployStrategy = 'rolling' | 'recreate' | 'blue_green' | 'canary';
export type DeployStatus = 'pending' | 'deploying' | 'running' | 'degraded' | 'failed';

export interface AgentOrchestratorConfig {
  id: string;
  agent_id: string;
  platform: OrchestratorPlatform;
  cluster_name: string;
  namespace: string;
  auto_scale: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentDeployment {
  id: string;
  config_id: string;
  deployment_name: string;
  replica_count: number;
  desired_replicas: number;
  strategy: DeployStrategy;
  status: DeployStatus;
  image_ref: string;
  created_at: string;
  updated_at: string;
}

export interface AgentOrchestratorEvent {
  id: string;
  deployment_id: string;
  event_type: string;
  message?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
}

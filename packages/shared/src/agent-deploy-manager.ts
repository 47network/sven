export type DeployStrategy = 'rolling' | 'blue_green' | 'canary' | 'recreate' | 'a_b';
export type DeployState = 'preparing' | 'deploying' | 'verifying' | 'completed' | 'failed' | 'rolled_back';

export interface AgentDeployConfig {
  id: string; agent_id: string; strategy: DeployStrategy; target_env: string;
  health_check_url: string; rollback_on_failure: boolean; approval_required: boolean;
  max_instances: number; status: string; created_at: string; updated_at: string;
}
export interface AgentDeployment {
  id: string; config_id: string; version: string; image_ref: string;
  target_env: string; state: DeployState; instances_total: number;
  instances_ready: number; started_at: string; completed_at: string; created_at: string;
}
export interface AgentDeployHealthCheck {
  id: string; deployment_id: string; check_type: string; endpoint: string;
  status_code: number; response_ms: number; healthy: boolean; checked_at: string;
}

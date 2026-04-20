export type BGColor = 'blue' | 'green';
export type BGHealthStatus = 'healthy' | 'unhealthy' | 'unknown';
export type BGSwitchStatus = 'pending' | 'switching' | 'completed' | 'rolled_back' | 'failed';

export interface BlueGreenSwitcherConfig {
  id: string;
  agentId: string;
  switchTimeoutMs: number;
  healthCheckRetries: number;
  autoRollback: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BGEnvironment {
  id: string;
  configId: string;
  name: string;
  color: BGColor;
  endpoint: string;
  isLive: boolean;
  version?: string;
  healthStatus: BGHealthStatus;
  createdAt: string;
}

export interface BGSwitch {
  id: string;
  configId: string;
  fromColor: BGColor;
  toColor: BGColor;
  status: BGSwitchStatus;
  startedAt: string;
  completedAt?: string;
}

export type SwitchStrategy = 'instant' | 'gradual' | 'canary_first' | 'weighted';
export type SlotColor = 'blue' | 'green';
export type HealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

export interface AgentBlueGreenRouterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  switchStrategy: SwitchStrategy;
  healthCheckInterval: number;
  warmupSeconds: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentEnvironmentSlot {
  id: string;
  configId: string;
  slotName: string;
  slotColor: SlotColor;
  endpointUrl?: string;
  isLive: boolean;
  healthStatus: HealthStatus;
  deployedVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTrafficSwitch {
  id: string;
  configId: string;
  fromSlotId?: string;
  toSlotId?: string;
  status: string;
  switchedAt?: Date;
  rollbackAt?: Date;
}

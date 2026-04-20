export interface EnvProvisionerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  provider: string;
  templateRepo: string | null;
  autoCleanup: boolean;
  maxEnvironments: number;
  ttlHours: number;
  resourceLimits: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionedEnvironment {
  id: string;
  configId: string;
  name: string;
  status: string;
  url: string | null;
  resources: Record<string, unknown>;
  expiresAt: string;
  createdAt: string;
}

export interface EnvironmentCleanup {
  id: string;
  environmentId: string;
  reason: string;
  resourcesFreed: Record<string, unknown>;
  cleanedAt: string;
}

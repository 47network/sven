/* Batch 144 — Agent Blueprint System */

export enum BlueprintScope {
  Agent = 'agent',
  Crew = 'crew',
  Service = 'service',
  Platform = 'platform',
  Organisation = 'organisation',
}

export enum BlueprintStatus {
  Draft = 'draft',
  Validated = 'validated',
  Published = 'published',
  Deprecated = 'deprecated',
  Archived = 'archived',
}

export enum ComponentSlot {
  Core = 'core',
  Adapter = 'adapter',
  Plugin = 'plugin',
  Middleware = 'middleware',
  Extension = 'extension',
  Driver = 'driver',
}

export enum InstanceStatus {
  Provisioning = 'provisioning',
  Running = 'running',
  Paused = 'paused',
  Failed = 'failed',
  Terminated = 'terminated',
}

export interface SystemBlueprint {
  id: string;
  agentId: string;
  name: string;
  scope: BlueprintScope;
  status: BlueprintStatus;
  version: string;
  description?: string;
  componentCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlueprintComponent {
  id: string;
  blueprintId: string;
  slot: ComponentSlot;
  componentName: string;
  componentType: string;
  config: Record<string, unknown>;
  required: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface BlueprintInstance {
  id: string;
  blueprintId: string;
  instanceName: string;
  status: InstanceStatus;
  overrides: Record<string, unknown>;
  healthScore: number;
  startedAt?: Date;
  stoppedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlueprintSystemStats {
  totalBlueprints: number;
  publishedCount: number;
  runningInstances: number;
  avgComponentCount: number;
  avgHealthScore: number;
}

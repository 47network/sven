/* Batch 161 — Agent Disaster Recovery */

export type AgentDrTier = 'critical' | 'high' | 'medium' | 'low';

export type AgentDrStrategy =
  | 'active_active'
  | 'active_passive'
  | 'pilot_light'
  | 'backup_restore'
  | 'cold_standby';

export type AgentDrPlanStatus = 'draft' | 'active' | 'testing' | 'triggered' | 'completed';

export type AgentDrFailoverTrigger = 'manual' | 'automatic' | 'scheduled_drill' | 'incident';

export type AgentDrFailoverStatus = 'initiated' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export type AgentDrCheckpointType = 'snapshot' | 'replication_lag' | 'health_check' | 'sync_status';

export type AgentDrCheckpointStatus = 'healthy' | 'degraded' | 'stale' | 'missing';

export interface AgentDrPlan {
  id: string;
  tenantId: string;
  planName: string;
  tier: AgentDrTier;
  rpoSeconds: number;
  rtoSeconds: number;
  strategy: AgentDrStrategy;
  primaryRegion: string;
  failoverRegion: string;
  services: unknown[];
  runbookUrl: string | null;
  lastTestedAt: string | null;
  status: AgentDrPlanStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDrFailover {
  id: string;
  planId: string;
  triggerType: AgentDrFailoverTrigger;
  triggerReason: string | null;
  failoverStatus: AgentDrFailoverStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  servicesFailed: unknown[];
  dataLossBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentDrCheckpoint {
  id: string;
  planId: string;
  checkpointType: AgentDrCheckpointType;
  serviceName: string;
  status: AgentDrCheckpointStatus;
  lagMs: number | null;
  lastSyncAt: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentDisasterRecoveryStats {
  totalPlans: number;
  activePlans: number;
  totalFailovers: number;
  avgRtoSeconds: number;
  lastDrillAt: string | null;
}

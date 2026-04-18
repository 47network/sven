/* Batch 48 — Agent Deployment Pipelines shared types */

export type DeploymentPipelineStatus = 'draft' | 'building' | 'testing' | 'staging' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';

export type DeploymentTriggerType = 'manual' | 'schedule' | 'event' | 'commit' | 'api';

export type DeploymentEnvironment = 'development' | 'staging' | 'production' | 'canary';

export type DeploymentStageName = 'build' | 'test' | 'lint' | 'security_scan' | 'staging' | 'approval' | 'deploy' | 'health_check' | 'rollback';

export type DeploymentStageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';

export type DeploymentArtifactType = 'container_image' | 'binary' | 'config_bundle' | 'skill_package' | 'model_weights' | 'documentation';

export type RollbackType = 'automatic' | 'manual' | 'emergency';

export type RollbackStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type EnvironmentHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface DeploymentPipeline {
  id: string;
  agentId: string;
  pipelineName: string;
  status: DeploymentPipelineStatus;
  triggerType: DeploymentTriggerType;
  environment: DeploymentEnvironment;
  config: Record<string, unknown>;
  versionTag?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentStage {
  id: string;
  pipelineId: string;
  stageName: DeploymentStageName;
  stageOrder: number;
  status: DeploymentStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  logs?: string;
  artifacts: Record<string, unknown>;
  createdAt: string;
}

export interface DeploymentArtifact {
  id: string;
  pipelineId: string;
  artifactType: DeploymentArtifactType;
  name: string;
  version: string;
  sizeBytes?: number;
  checksum?: string;
  storageUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DeploymentRollback {
  id: string;
  pipelineId: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  rollbackType: RollbackType;
  status: RollbackStatus;
  initiatedBy: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface DeploymentEnv {
  id: string;
  environmentName: string;
  environmentType: DeploymentEnvironment;
  config: Record<string, unknown>;
  healthStatus: EnvironmentHealthStatus;
  currentVersion?: string;
  lastDeployedAt?: string;
  resourceLimits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const PIPELINE_STATUSES: DeploymentPipelineStatus[] = ['draft', 'building', 'testing', 'staging', 'deploying', 'deployed', 'failed', 'rolled_back'];

export const TRIGGER_TYPES: DeploymentTriggerType[] = ['manual', 'schedule', 'event', 'commit', 'api'];

export const DEPLOYMENT_ENVIRONMENTS: DeploymentEnvironment[] = ['development', 'staging', 'production', 'canary'];

export const STAGE_NAMES: DeploymentStageName[] = ['build', 'test', 'lint', 'security_scan', 'staging', 'approval', 'deploy', 'health_check', 'rollback'];

export const ARTIFACT_TYPES: DeploymentArtifactType[] = ['container_image', 'binary', 'config_bundle', 'skill_package', 'model_weights', 'documentation'];

export const ENVIRONMENT_HEALTH_STATUSES: EnvironmentHealthStatus[] = ['healthy', 'degraded', 'unhealthy', 'unknown'];

export function canPromoteEnvironment(from: DeploymentEnvironment, to: DeploymentEnvironment): boolean {
  const order: DeploymentEnvironment[] = ['development', 'staging', 'canary', 'production'];
  return order.indexOf(to) > order.indexOf(from);
}

export function isTerminalStatus(status: DeploymentPipelineStatus): boolean {
  return ['deployed', 'failed', 'rolled_back'].includes(status);
}

export function getNextStage(current: DeploymentStageName): DeploymentStageName | null {
  const pipeline: DeploymentStageName[] = ['build', 'test', 'lint', 'security_scan', 'staging', 'approval', 'deploy', 'health_check'];
  const idx = pipeline.indexOf(current);
  if (idx === -1 || idx === pipeline.length - 1) return null;
  return pipeline[idx + 1];
}

export function estimateDeploymentRisk(environment: DeploymentEnvironment, hasTests: boolean, hasApproval: boolean): 'low' | 'medium' | 'high' | 'critical' {
  if (environment === 'production' && !hasApproval) return 'critical';
  if (environment === 'production' && !hasTests) return 'high';
  if (environment === 'canary') return 'medium';
  if (environment === 'staging') return 'low';
  return 'low';
}

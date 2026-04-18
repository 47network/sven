// Batch 71 — Agent Pipeline Templates

export type PipelineCategory = 'general' | 'ci_cd' | 'data' | 'ml' | 'content' | 'publishing' | 'testing' | 'deployment';
export type PipelineInstanceStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type PipelineTriggerType = 'manual' | 'schedule' | 'event' | 'webhook' | 'condition';
export type PipelineAction = 'template_create' | 'instance_launch' | 'stage_advance' | 'pipeline_pause' | 'trigger_configure' | 'artifact_store' | 'pipeline_report';

export interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  category: PipelineCategory;
  version: string;
  authorAgentId?: string;
  stages: Array<{ name: string; taskType: string; dependsOn?: number[] }>;
  parameters: Record<string, unknown>;
  isPublic: boolean;
  usageCount: number;
  rating: number;
}

export interface PipelineInstance {
  id: string;
  templateId: string;
  agentId?: string;
  name: string;
  status: PipelineInstanceStatus;
  currentStage: number;
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
}

export interface PipelineStage {
  id: string;
  instanceId: string;
  stageIndex: number;
  name: string;
  taskType: string;
  status: PipelineStageStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
}

export interface PipelineTrigger {
  id: string;
  templateId: string;
  triggerType: PipelineTriggerType;
  config: Record<string, unknown>;
  enabled: boolean;
  lastFiredAt?: string;
}

export interface PipelineArtifact {
  id: string;
  instanceId: string;
  stageId?: string;
  name: string;
  artifactType: 'file' | 'report' | 'log' | 'metric' | 'model' | 'dataset';
  sizeBytes: number;
}

export const PIPELINE_CATEGORIES: PipelineCategory[] = ['general', 'ci_cd', 'data', 'ml', 'content', 'publishing', 'testing', 'deployment'];
export const PIPELINE_INSTANCE_STATUSES: PipelineInstanceStatus[] = ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'];
export const PIPELINE_STAGE_STATUSES: PipelineStageStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped'];
export const PIPELINE_TRIGGER_TYPES: PipelineTriggerType[] = ['manual', 'schedule', 'event', 'webhook', 'condition'];

export function canAdvanceStage(current: PipelineStageStatus): boolean {
  return current === 'completed';
}
export function isPipelineTerminal(status: PipelineInstanceStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
export function getNextStageIndex(currentStage: number, totalStages: number): number | null {
  return currentStage + 1 < totalStages ? currentStage + 1 : null;
}
export function calculatePipelineProgress(currentStage: number, totalStages: number): number {
  return totalStages > 0 ? Math.round((currentStage / totalStages) * 100) : 0;
}

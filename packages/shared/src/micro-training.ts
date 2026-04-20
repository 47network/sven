// ---------------------------------------------------------------------------
// Micro-Training — shared types for the model-trainer + micrograd skills
// ---------------------------------------------------------------------------

// ── Training job status lifecycle ──────────────────────────────
export type TrainingJobStatus =
  | 'pending'
  | 'preparing'
  | 'training'
  | 'evaluating'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const TRAINING_JOB_STATUSES: TrainingJobStatus[] = [
  'pending', 'preparing', 'training', 'evaluating',
  'exporting', 'completed', 'failed', 'cancelled',
];

// ── Adapter method ─────────────────────────────────────────────
export type AdapterType = 'lora' | 'qlora' | 'full';

export const ADAPTER_TYPES: AdapterType[] = ['lora', 'qlora', 'full'];

// ── Recipe domain ──────────────────────────────────────────────
export type RecipeDomain =
  | 'writing_style'
  | 'codebase_conventions'
  | 'domain_vocabulary'
  | 'task_specific'
  | 'custom';

export const RECIPE_DOMAINS: RecipeDomain[] = [
  'writing_style', 'codebase_conventions', 'domain_vocabulary',
  'task_specific', 'custom',
];

// ── Data format ────────────────────────────────────────────────
export type TrainingDataFormat =
  | 'conversation'
  | 'instruction'
  | 'completion'
  | 'preference';

export const TRAINING_DATA_FORMATS: TrainingDataFormat[] = [
  'conversation', 'instruction', 'completion', 'preference',
];

// ── Loss function (micrograd) ──────────────────────────────────
export type LossFunction = 'mse' | 'hinge' | 'bce';

export const LOSS_FUNCTIONS: LossFunction[] = ['mse', 'hinge', 'bce'];

// ── Interfaces ─────────────────────────────────────────────────

export interface TrainingJobRecord {
  id: string;
  orgId: string;
  agentId: string | null;
  userId: string | null;
  status: TrainingJobStatus;
  baseModel: string;
  adapterType: AdapterType;
  recipe: RecipeDomain | null;
  datasetId: string | null;
  dataSources: unknown[];
  sampleCount: number;
  trainSamples: number;
  evalSamples: number;
  hyperparams: Record<string, unknown>;
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  metrics: TrainingMetric[];
  evaluation: TrainingEvaluation | null;
  outputModel: string | null;
  adapterPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface TrainingMetric {
  epoch: number;
  step: number;
  trainLoss: number;
  evalLoss: number | null;
  learningRate: number;
  gradNorm: number | null;
  timestamp: string;
}

export interface TrainingEvaluation {
  improvement: number;
  perplexity: number;
  baselineScore: number;
  finetuneScore: number;
  evaluationPrompts: number;
}

export interface TrainingDatasetRecord {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  dataFormat: TrainingDataFormat;
  sampleCount: number;
  sizeBytes: number;
  sourceUrl: string | null;
  storagePath: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingRecipeRecord {
  id: string;
  orgId: string;
  domain: RecipeDomain;
  name: string;
  description: string | null;
  baseModel: string;
  adapterType: AdapterType;
  config: Record<string, unknown>;
  evaluationPrompts: unknown[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MicrogradSessionRecord {
  id: string;
  orgId: string;
  architecture: number[];
  datasetType: 'xor' | 'moon' | 'custom';
  lossFunction: LossFunction;
  epochs: number;
  finalLoss: number | null;
  finalAccuracy: number | null;
  converged: boolean;
  walkthroughProgress: number;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────

export const TRAINING_STATUS_ORDER: TrainingJobStatus[] = [
  'pending', 'preparing', 'training', 'evaluating', 'exporting', 'completed',
];

export const DEFAULT_TRAINING_CONFIG = {
  baseModel: 'Qwen2.5-4B',
  adapterType: 'lora' as AdapterType,
  epochs: 3,
  batchSize: 4,
  learningRate: 2e-4,
  loraRank: 16,
  loraAlpha: 32,
  quantBits: 4,
  warmupRatio: 0.03,
  maxSeqLength: 2048,
} as const;

// ── Utility functions ──────────────────────────────────────────

/** Check if a training job is in a terminal state. */
export function MicrotisTerminalStatus(status: TrainingJobStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/** Compute training progress as 0–100. */
export function computeProgress(currentStep: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.min(100, Math.round((currentStep / totalSteps) * 100));
}

/** Validate that a job can advance from current status to next. */
export function canAdvanceTrainingStatus(
  current: TrainingJobStatus,
  next: TrainingJobStatus,
): boolean {
  if (MicrotisTerminalStatus(current)) return false;
  if (next === 'cancelled') return !MicrotisTerminalStatus(current);
  if (next === 'failed') return !MicrotisTerminalStatus(current);
  const ci = TRAINING_STATUS_ORDER.indexOf(current);
  const ni = TRAINING_STATUS_ORDER.indexOf(next);
  return ci >= 0 && ni >= 0 && ni === ci + 1;
}

/** Estimate training time in minutes based on sample count and epochs. */
export function estimateTrainingMinutes(
  sampleCount: number,
  epochs: number,
  batchSize: number = 4,
): number {
  const stepsPerEpoch = Math.ceil(sampleCount / batchSize);
  const totalSteps = stepsPerEpoch * epochs;
  // Rough estimate: ~0.5s per step on consumer GPU
  return Math.ceil((totalSteps * 0.5) / 60);
}

/** Check if evaluation shows meaningful improvement. */
export function isSignificantImprovement(evaluation: TrainingEvaluation): boolean {
  return evaluation.improvement > 0.05 && evaluation.finetuneScore > evaluation.baselineScore;
}

// ---------------------------------------------------------------------------
// Model Trainer Engine — LoRA/QLoRA Fine-Tuning Pipeline
// ---------------------------------------------------------------------------
// Manages fine-tuning jobs for small open models (Qwen3-4B, Gemma, etc.)
// on domain-specific data using LoRA/QLoRA adapters.
// Training data prep → LoRA fine-tune → evaluation → export to LiteLLM.
// Pre-built recipes: writing style, codebase conventions, domain vocabulary.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';
import { JobManager, type MeshJob } from '@sven/compute-mesh';
import { type ResourceRequirements } from '@sven/compute-mesh';

const logger = createLogger('model-trainer');

/* ------------------------------------------------------------------ types */

export type TrainingStatus = 'pending' | 'preparing' | 'training' | 'evaluating' | 'exporting' | 'completed' | 'failed' | 'cancelled';
export type TrainingMethod = 'lora' | 'qlora' | 'full';
export type DataFormat = 'conversation' | 'instruction' | 'completion' | 'preference';
export type RecipeDomain = 'writing_style' | 'codebase_conventions' | 'domain_vocabulary' | 'task_specific' | 'custom';
export type QuantBits = 4 | 8 | 16 | 32;

export interface LoraConfig {
  rank: number; // LoRA rank (4, 8, 16, 32, 64)
  alpha: number; // LoRA alpha (typically 2x rank)
  dropout: number; // 0.0–0.3
  targetModules: string[]; // e.g. ['q_proj', 'v_proj', 'k_proj', 'o_proj']
  quantBits: QuantBits; // QLoRA quantisation (4 for QLoRA, 16/32 for standard LoRA)
}

export interface TrainingConfig {
  baseModel: string; // e.g. 'Qwen/Qwen2.5-4B', 'google/gemma-2-2b'
  method: TrainingMethod;
  lora: LoraConfig;
  epochs: number; // 1–10
  batchSize: number; // per-device batch size
  gradientAccumulation: number; // effective batch = batchSize * gradientAccumulation
  learningRate: number; // e.g. 2e-4
  warmupSteps: number;
  maxSteps: number; // 0 = determined by epochs
  evalSteps: number; // evaluate every N steps
  saveSteps: number; // checkpoint every N steps
  maxSeqLength: number; // max token sequence length
  fp16: boolean;
  bf16: boolean;
  gradientCheckpointing: boolean;
  dataFormat: DataFormat;
  seed: number;
  timeoutMs: number;
}

export interface TrainingDataSource {
  type: 'conversation_logs' | 'file_upload' | 'inline' | 'rag_documents';
  path?: string; // file path or RAG collection
  data?: TrainingSample[]; // inline data
  filters?: Record<string, unknown>; // query filters for conversation/RAG sources
  maxSamples?: number;
}

export interface TrainingSample {
  id: string;
  input: string;
  output: string;
  system?: string;
  metadata?: Record<string, unknown>;
}

export interface TrainingMetrics {
  step: number;
  epoch: number;
  trainLoss: number;
  evalLoss?: number;
  learningRate: number;
  throughputSamplesPerSec: number;
  gpuMemoryMb: number;
  elapsedMs: number;
}

export interface EvaluationResult {
  baselineScore: number;
  finetuneScore: number;
  improvement: number; // percentage
  perplexity: number;
  bleuScore?: number;
  rougeScore?: { rouge1: number; rouge2: number; rougeL: number };
  humanEvalSamples: EvalSample[];
}

export interface EvalSample {
  input: string;
  baselineOutput: string;
  finetuneOutput: string;
  score: number; // 0.0–1.0
}

export interface TrainingRecipe {
  domain: RecipeDomain;
  name: string;
  description: string;
  baseModel: string;
  config: Partial<TrainingConfig>;
  dataPrep: DataPrepConfig;
  evaluationPrompts: string[];
}

export interface DataPrepConfig {
  sourceType: TrainingDataSource['type'];
  format: DataFormat;
  systemPrompt?: string;
  minSampleLength: number;
  maxSampleLength: number;
  deduplication: boolean;
  shuffleSeed: number;
  trainSplit: number; // 0.0–1.0 (fraction for training)
}

export interface TrainingJob {
  id: string;
  orgId: string;
  userId?: string;
  status: TrainingStatus;
  recipe?: RecipeDomain;
  config: TrainingConfig;
  dataSources: TrainingDataSource[];
  sampleCount: number;
  trainSamples: number;
  evalSamples: number;
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  metrics: TrainingMetrics[];
  evaluation?: EvaluationResult;
  outputAdapterPath?: string;
  outputModelName?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelExport {
  jobId: string;
  adapterPath: string;
  baseModel: string;
  mergedModelPath?: string;
  litellmModelName: string;
  registeredAt: string;
}

export interface TrainerStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageTrainingTimeMs: number;
  averageImprovement: number;
  totalSamplesProcessed: number;
}

/* -------------------------------------------------------------- constants */

export const DEFAULT_LORA_CONFIG: LoraConfig = {
  rank: 16,
  alpha: 32,
  dropout: 0.05,
  targetModules: ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
  quantBits: 4, // QLoRA by default
};

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  baseModel: 'Qwen/Qwen2.5-4B',
  method: 'qlora',
  lora: DEFAULT_LORA_CONFIG,
  epochs: 3,
  batchSize: 4,
  gradientAccumulation: 4,
  learningRate: 2e-4,
  warmupSteps: 100,
  maxSteps: 0,
  evalSteps: 50,
  saveSteps: 100,
  maxSeqLength: 2048,
  fp16: false,
  bf16: true,
  gradientCheckpointing: true,
  dataFormat: 'conversation',
  seed: 42,
  timeoutMs: 4 * 60 * 60 * 1000, // 4 hours
};

export const TRAINING_RECIPES: TrainingRecipe[] = [
  {
    domain: 'writing_style',
    name: 'Writing Style Adaptation',
    description: 'Fine-tune on user\'s writing style for email/message drafting. Learns tone, vocabulary, sentence structure.',
    baseModel: 'Qwen/Qwen2.5-4B',
    config: {
      epochs: 3,
      learningRate: 2e-4,
      maxSeqLength: 1024,
    },
    dataPrep: {
      sourceType: 'conversation_logs',
      format: 'conversation',
      systemPrompt: 'You are a writing assistant that matches the user\'s personal writing style.',
      minSampleLength: 50,
      maxSampleLength: 2000,
      deduplication: true,
      shuffleSeed: 42,
      trainSplit: 0.9,
    },
    evaluationPrompts: [
      'Write a professional email declining a meeting invitation.',
      'Draft a casual message to a friend about weekend plans.',
      'Write a project update summary for the team.',
    ],
  },
  {
    domain: 'codebase_conventions',
    name: 'Codebase Convention Learning',
    description: 'Fine-tune on codebase patterns for code generation. Learns naming conventions, patterns, architecture.',
    baseModel: 'Qwen/Qwen2.5-4B',
    config: {
      epochs: 2,
      learningRate: 1e-4,
      maxSeqLength: 4096,
    },
    dataPrep: {
      sourceType: 'rag_documents',
      format: 'instruction',
      systemPrompt: 'You are a code generation assistant that follows the project\'s established conventions and patterns.',
      minSampleLength: 100,
      maxSampleLength: 8000,
      deduplication: true,
      shuffleSeed: 42,
      trainSplit: 0.85,
    },
    evaluationPrompts: [
      'Create a new REST endpoint following the project conventions.',
      'Write a unit test for a service function.',
      'Implement error handling following project patterns.',
    ],
  },
  {
    domain: 'domain_vocabulary',
    name: 'Domain Vocabulary Specialist',
    description: 'Fine-tune on domain-specific vocabulary and knowledge. Learns industry terms, acronyms, relationships.',
    baseModel: 'Qwen/Qwen2.5-4B',
    config: {
      epochs: 5,
      learningRate: 3e-4,
      maxSeqLength: 2048,
    },
    dataPrep: {
      sourceType: 'rag_documents',
      format: 'instruction',
      systemPrompt: 'You are a domain specialist with deep knowledge of the following field.',
      minSampleLength: 30,
      maxSampleLength: 4000,
      deduplication: true,
      shuffleSeed: 42,
      trainSplit: 0.9,
    },
    evaluationPrompts: [
      'Explain a key concept from this domain to a newcomer.',
      'Summarise the relationship between two domain entities.',
      'Answer a technical question using domain-specific terminology.',
    ],
  },
];

/* ----------------------------------------------------------- job store */

const jobStore = new Map<string, TrainingJob>();
const exportStore = new Map<string, ModelExport>();
let idCounter = 0;

function nextId(): string {
  return `train_${++idCounter}_${Date.now()}`;
}

/* -------------------------------------------------------- data preparation */

/**
 * Validates training data samples.
 */
export function validateSamples(samples: TrainingSample[]): { valid: TrainingSample[]; errors: string[] } {
  const valid: TrainingSample[] = [];
  const errors: string[] = [];

  for (const sample of samples) {
    if (!sample.input || typeof sample.input !== 'string') {
      errors.push(`Sample ${sample.id}: missing or invalid input`);
      continue;
    }
    if (!sample.output || typeof sample.output !== 'string') {
      errors.push(`Sample ${sample.id}: missing or invalid output`);
      continue;
    }
    if (sample.input.length < 5) {
      errors.push(`Sample ${sample.id}: input too short (< 5 chars)`);
      continue;
    }
    if (sample.output.length < 5) {
      errors.push(`Sample ${sample.id}: output too short (< 5 chars)`);
      continue;
    }
    valid.push(sample);
  }

  return { valid, errors };
}

/**
 * Splits samples into train/eval sets.
 */
export function splitDataset(
  samples: TrainingSample[],
  trainSplit: number,
  seed: number,
): { train: TrainingSample[]; eval: TrainingSample[] } {
  // Deterministic shuffle using seed
  const shuffled = [...samples];
  let m = shuffled.length;
  let s = seed;
  while (m > 0) {
    // Simple LCG pseudo-random
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const i = s % m;
    m--;
    [shuffled[m], shuffled[i]] = [shuffled[i], shuffled[m]];
  }

  const splitIdx = Math.round(shuffled.length * Math.max(0.5, Math.min(0.99, trainSplit)));
  return {
    train: shuffled.slice(0, splitIdx),
    eval: shuffled.slice(splitIdx),
  };
}

/**
 * Formats a sample into the chat-template format for fine-tuning.
 */
export function formatSampleForTraining(
  sample: TrainingSample,
  format: DataFormat,
  systemPrompt?: string,
): string {
  switch (format) {
    case 'conversation':
      return JSON.stringify({
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: sample.input },
          { role: 'assistant', content: sample.output },
        ],
      });

    case 'instruction':
      return JSON.stringify({
        instruction: sample.input,
        output: sample.output,
        ...(systemPrompt ? { system: systemPrompt } : {}),
      });

    case 'completion':
      return `${sample.input}\n${sample.output}`;

    case 'preference':
      return JSON.stringify({
        prompt: sample.input,
        chosen: sample.output,
        rejected: '', // placeholder — real impl would have rejected sample
      });

    default:
      return JSON.stringify({ input: sample.input, output: sample.output });
  }
}

/* ---------------------------------------------------------- training args */

/** Provider interface for actual training execution (decoupled for testability). */
export interface TrainingRunner {
  startTraining(job: TrainingJob, trainData: string[], evalData: string[]): Promise<void>;
  getProgress(jobId: string): Promise<{ step: number; loss: number; done: boolean }>;
  cancelTraining(jobId: string): Promise<boolean>;
}

/**
 * Builds the HuggingFace transformers / PEFT CLI arguments for a training job.
 */
export function buildTrainingArgs(job: TrainingJob): string[] {
  const c = job.config;
  const args: string[] = [
    '--model_name_or_path', c.baseModel,
    '--output_dir', `/tmp/sven-training/${job.id}`,
    '--num_train_epochs', String(c.epochs),
    '--per_device_train_batch_size', String(c.batchSize),
    '--gradient_accumulation_steps', String(c.gradientAccumulation),
    '--learning_rate', String(c.learningRate),
    '--warmup_steps', String(c.warmupSteps),
    '--max_seq_length', String(c.maxSeqLength),
    '--eval_steps', String(c.evalSteps),
    '--save_steps', String(c.saveSteps),
    '--seed', String(c.seed),
    '--logging_steps', '10',
    '--evaluation_strategy', 'steps',
    '--save_strategy', 'steps',
    '--load_best_model_at_end',
    '--report_to', 'none',
  ];

  if (c.bf16) args.push('--bf16');
  else if (c.fp16) args.push('--fp16');

  if (c.gradientCheckpointing) args.push('--gradient_checkpointing');

  if (c.maxSteps > 0) {
    args.push('--max_steps', String(c.maxSteps));
  }

  // LoRA / QLoRA args
  if (c.method === 'lora' || c.method === 'qlora') {
    args.push(
      '--use_peft',
      '--lora_r', String(c.lora.rank),
      '--lora_alpha', String(c.lora.alpha),
      '--lora_dropout', String(c.lora.dropout),
      '--lora_target_modules', c.lora.targetModules.join(','),
    );
    if (c.method === 'qlora') {
      args.push('--load_in_4bit');
      args.push('--bnb_4bit_compute_dtype', 'bfloat16');
      args.push('--bnb_4bit_quant_type', 'nf4');
    }
  }

  return args;
}

/* ----------------------------------------------------------- job management */

/**
 * Creates a new training job.
 */
export function createTrainingJob(opts: {
  orgId: string;
  userId?: string;
  recipe?: RecipeDomain;
  config?: Partial<TrainingConfig>;
  dataSources: TrainingDataSource[];
  samples?: TrainingSample[];
}): TrainingJob {
  const id = nextId();
  const now = new Date().toISOString();

  // Resolve config from recipe or defaults
  let baseConfig = { ...DEFAULT_TRAINING_CONFIG };
  if (opts.recipe && opts.recipe !== 'custom') {
    const recipe = TRAINING_RECIPES.find((r) => r.domain === opts.recipe);
    if (recipe) {
      baseConfig = { ...baseConfig, ...recipe.config, baseModel: recipe.baseModel };
    }
  }
  const config = { ...baseConfig, ...opts.config };

  // Validate and split samples if provided
  let sampleCount = 0;
  let trainSamples = 0;
  let evalSamples = 0;

  if (opts.samples && opts.samples.length > 0) {
    const { valid } = validateSamples(opts.samples);
    const split = splitDataset(valid, 0.9, config.seed);
    sampleCount = valid.length;
    trainSamples = split.train.length;
    evalSamples = split.eval.length;
  }

  const job: TrainingJob = {
    id,
    orgId: opts.orgId,
    userId: opts.userId,
    status: 'pending',
    recipe: opts.recipe,
    config,
    dataSources: opts.dataSources,
    sampleCount,
    trainSamples,
    evalSamples,
    currentStep: 0,
    totalSteps: 0,
    currentEpoch: 0,
    metrics: [],
    createdAt: now,
    updatedAt: now,
  };

  // Evict oldest completed/failed if at capacity (50 max)
  if (jobStore.size >= 50) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of jobStore) {
      if (v.status === 'completed' || v.status === 'failed' || v.status === 'cancelled') {
        const t = new Date(v.createdAt).getTime();
        if (t < oldestTime) {
          oldestTime = t;
          oldest = k;
        }
      }
    }
    if (oldest) jobStore.delete(oldest);
  }

  jobStore.set(id, job);
  logger.info('training job created', { jobId: id, orgId: opts.orgId, recipe: opts.recipe, baseModel: config.baseModel });
  return job;
}

/**
 * Gets a training job by ID.
 */
export function getTrainingJob(jobId: string): TrainingJob | undefined {
  return jobStore.get(jobId);
}

/**
 * Lists training jobs, optionally filtered by status.
 */
export function listTrainingJobs(orgId: string, status?: TrainingStatus): TrainingJob[] {
  const results: TrainingJob[] = [];
  for (const job of jobStore.values()) {
    if (job.orgId !== orgId) continue;
    if (status && job.status !== status) continue;
    results.push(job);
  }
  return results;
}

/**
 * Cancels a training job.
 */
export function cancelTrainingJob(jobId: string): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return false;

  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  logger.info('training job cancelled', { jobId });
  return true;
}

/**
 * Records a training metrics checkpoint.
 */
export function recordMetrics(jobId: string, metrics: TrainingMetrics): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;
  if (job.status !== 'training') return false;

  job.metrics.push(metrics);
  job.currentStep = metrics.step;
  job.currentEpoch = metrics.epoch;
  job.updatedAt = new Date().toISOString();

  // Cap metrics history (keep last 500)
  if (job.metrics.length > 500) {
    job.metrics = job.metrics.slice(-250);
  }

  return true;
}

/**
 * Records evaluation results and marks job complete.
 */
export function recordEvaluation(jobId: string, evaluation: EvaluationResult, adapterPath: string): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;

  job.evaluation = evaluation;
  job.outputAdapterPath = adapterPath;
  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.updatedAt = job.completedAt;

  logger.info(
    'training job completed with evaluation',
    { jobId, improvement: evaluation.improvement, perplexity: evaluation.perplexity },
  );
  return true;
}

/**
 * Marks a training job as failed.
 */
export function failTrainingJob(jobId: string, errorMessage: string): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;

  job.status = 'failed';
  job.errorMessage = errorMessage;
  job.updatedAt = new Date().toISOString();

  logger.error('training job failed', { jobId, error: errorMessage });
  return true;
}

/**
 * Transitions a job's status (with validation).
 */
export function transitionJobStatus(jobId: string, newStatus: TrainingStatus): boolean {
  const job = jobStore.get(jobId);
  if (!job) return false;

  const validTransitions: Record<TrainingStatus, TrainingStatus[]> = {
    pending: ['preparing', 'cancelled', 'failed'],
    preparing: ['training', 'cancelled', 'failed'],
    training: ['evaluating', 'cancelled', 'failed'],
    evaluating: ['exporting', 'completed', 'failed'],
    exporting: ['completed', 'failed'],
    completed: [],
    failed: [],
    cancelled: [],
  };

  if (!validTransitions[job.status]?.includes(newStatus)) {
    logger.warn('invalid training status transition', { jobId, from: job.status, to: newStatus });
    return false;
  }

  job.status = newStatus;
  job.updatedAt = new Date().toISOString();
  if (newStatus === 'training') job.startedAt = job.updatedAt;
  return true;
}

/* -------------------------------------------------------------- exports */

/**
 * Registers a fine-tuned model export for use via LiteLLM.
 */
export function registerExport(
  jobId: string,
  adapterPath: string,
  litellmModelName: string,
): ModelExport | null {
  const job = jobStore.get(jobId);
  if (!job || job.status !== 'completed') return null;

  const exp: ModelExport = {
    jobId,
    adapterPath,
    baseModel: job.config.baseModel,
    litellmModelName,
    registeredAt: new Date().toISOString(),
  };

  exportStore.set(jobId, exp);
  job.outputModelName = litellmModelName;
  job.updatedAt = new Date().toISOString();

  logger.info('model export registered', { jobId, modelName: litellmModelName });
  return exp;
}

/**
 * Lists all registered model exports.
 */
export function listExports(): ModelExport[] {
  return Array.from(exportStore.values());
}

/* ------------------------------------------------------------------ stats */

/**
 * Returns aggregate training statistics.
 */
export function getTrainerStats(): TrainerStats {
  let active = 0;
  let completed = 0;
  let failed = 0;
  let totalTime = 0;
  let totalImprovement = 0;
  let completedWithEval = 0;
  let totalSamples = 0;

  for (const job of jobStore.values()) {
    if (job.status === 'training' || job.status === 'preparing' || job.status === 'evaluating') active++;
    if (job.status === 'completed') {
      completed++;
      if (job.startedAt && job.completedAt) {
        totalTime += new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
      }
      if (job.evaluation) {
        totalImprovement += job.evaluation.improvement;
        completedWithEval++;
      }
    }
    if (job.status === 'failed') failed++;
    totalSamples += job.sampleCount;
  }

  return {
    totalJobs: jobStore.size,
    activeJobs: active,
    completedJobs: completed,
    failedJobs: failed,
    averageTrainingTimeMs: completed > 0 ? Math.round(totalTime / completed) : 0,
    averageImprovement: completedWithEval > 0 ? totalImprovement / completedWithEval : 0,
    totalSamplesProcessed: totalSamples,
  };
}

/* ---------------------------------------------------------- recipes */

/**
 * Returns a recipe by domain.
 */
export function getRecipe(domain: RecipeDomain): TrainingRecipe | undefined {
  return TRAINING_RECIPES.find((r) => r.domain === domain);
}

/**
 * Lists all available recipes.
 */
export function listRecipes(): TrainingRecipe[] {
  return [...TRAINING_RECIPES];
}

/* ------------------------------------------- compute-mesh scheduling (H.1.6) */

let trainingJobManager: JobManager | null = null;

export function getTrainingJobManager(): JobManager {
  if (!trainingJobManager) {
    trainingJobManager = new JobManager();
  }
  return trainingJobManager;
}

export function setTrainingJobManager(jm: JobManager): void {
  trainingJobManager = jm;
}

export type GpuPreference = 'any' | 'nvidia' | 'amd' | 'none';

export interface ScheduleTrainingOptions {
  jobId: string;
  gpuPreference?: GpuPreference;
  minVramMb?: number;
  priority?: number;
  federationAllowed?: boolean;
}

/**
 * Schedule a training job onto the compute-mesh for distributed execution.
 * Maps training config (base model size, quantization bits) to resource requirements,
 * then creates a compute-mesh job that the scheduler can assign to the best device.
 *
 * Training is split into phases: prepare → train → evaluate → export.
 * Each phase is a pipeline stage in the mesh job.
 */
export function scheduleTrainingOnMesh(opts: ScheduleTrainingOptions): MeshJob | null {
  const job = jobStore.get(opts.jobId);
  if (!job) {
    logger.warn('Cannot schedule: training job not found', { jobId: opts.jobId });
    return null;
  }

  if (job.status !== 'pending') {
    logger.warn('Cannot schedule: job not in pending status', { jobId: opts.jobId, status: job.status });
    return null;
  }

  const jm = getTrainingJobManager();

  // Estimate resource requirements from training config
  const reqs = estimateTrainingResources(job);

  // Apply user overrides
  if (opts.minVramMb !== undefined && opts.minVramMb > reqs.minVramMb) {
    reqs.minVramMb = opts.minVramMb;
  }

  // Build pipeline stages: prepare → train → evaluate → export
  const stages = [
    {
      stage: 'prepare',
      action: 'data_preparation',
      jobId: job.id,
      baseModel: job.config.baseModel,
      sampleCount: job.sampleCount,
      dataFormat: job.config.dataFormat,
    },
    {
      stage: 'train',
      action: 'lora_finetune',
      jobId: job.id,
      baseModel: job.config.baseModel,
      method: job.config.method,
      epochs: job.config.epochs,
      batchSize: job.config.batchSize,
      loraRank: job.config.lora.rank,
      loraAlpha: job.config.lora.alpha,
      quantBits: job.config.lora.quantBits,
    },
    {
      stage: 'evaluate',
      action: 'model_evaluation',
      jobId: job.id,
      baseModel: job.config.baseModel,
    },
    {
      stage: 'export',
      action: 'register_adapter',
      jobId: job.id,
      baseModel: job.config.baseModel,
    },
  ];

  const meshJob = jm.createJob(
    `training-${job.id}`,
    `Fine-tune ${job.config.baseModel} (${job.config.method}, ${job.sampleCount} samples)`,
    {
      strategy: 'pipeline',
      stageCount: stages.length,
      payloads: stages,
      resourceReqs: {
        minCpuCores: reqs.minCpuCores,
        minRamMb: reqs.minRamMb,
        requiresGpu: reqs.requiresGpu,
        minVramMb: reqs.minVramMb,
        minStorageGb: reqs.minStorageGb,
      },
      priority: opts.priority ?? 6,
    },
    'confidential', // training data is confidential
    opts.federationAllowed ?? false,
  );

  // Transition training job to preparing
  transitionJobStatus(job.id, 'preparing');

  logger.info('training job scheduled on compute-mesh', {
    jobId: job.id,
    meshJobId: meshJob.id,
    baseModel: job.config.baseModel,
    method: job.config.method,
    gpuRequired: reqs.requiresGpu,
    estimatedVramMb: reqs.minVramMb,
  });

  return meshJob;
}

/**
 * Estimate compute resource requirements for a training job based on:
 * - Model parameter count (parsed from name)
 * - Quantization bits (4 for QLoRA, 16+ for standard)
 * - LoRA rank and target module count
 * - Batch size and gradient accumulation
 */
export function estimateTrainingResources(job: TrainingJob): ResourceRequirements {
  const config = job.config;

  // Parse parameter count from model name (e.g., "Qwen/Qwen2.5-4B" → 4)
  const paramMatch = config.baseModel.match(/(\d+(?:\.\d+)?)\s*[bB]/);
  const paramsB = paramMatch ? parseFloat(paramMatch[1]) : 4; // default 4B

  // Base VRAM: model weights + LoRA adapters + activations + optimizer states
  let vramMb: number;

  if (config.method === 'qlora') {
    // QLoRA: 4-bit base model + FP16 LoRA adapters + gradient states
    // ~0.6 GB per 1B params for 4-bit base + LoRA overhead
    vramMb = Math.ceil(paramsB * 600 + config.lora.rank * config.lora.targetModules.length * 2 + config.batchSize * config.maxSeqLength * 0.002);
  } else if (config.method === 'lora') {
    // Standard LoRA: FP16 base model + LoRA adapters
    // ~2 GB per 1B params for FP16 base + LoRA overhead
    vramMb = Math.ceil(paramsB * 2000 + config.lora.rank * config.lora.targetModules.length * 4 + config.batchSize * config.maxSeqLength * 0.004);
  } else {
    // Full fine-tuning: FP16 model + optimizer states (~4x model size)
    vramMb = Math.ceil(paramsB * 8000);
  }

  // RAM: at least 2x VRAM for data loading, preprocessing buffers
  const ramMb = Math.max(4096, vramMb * 2);

  // Storage: model cache + checkpoints + dataset
  const storageGb = Math.ceil(paramsB * 2 + 5); // model + checkpoints

  return {
    minCpuCores: Math.max(2, config.batchSize),
    minRamMb: ramMb,
    requiresGpu: config.method !== 'full' || paramsB <= 1, // GPU needed for QLoRA/LoRA, optional for tiny full fine-tune
    minVramMb: vramMb,
    minStorageGb: storageGb,
    requiredRuntimes: ['python', 'pytorch'],
  };
}

/**
 * List compute-mesh jobs associated with training.
 */
export function listTrainingMeshJobs(): MeshJob[] {
  const jm = getTrainingJobManager();
  return jm.list().filter((j) => j.name.startsWith('training-'));
}

/**
 * Get training mesh job progress for a specific training job.
 */
export function getTrainingMeshProgress(jobId: string): ReturnType<JobManager['progress']> {
  const jm = getTrainingJobManager();
  const meshJob = jm.list().find((j) => j.name === `training-${jobId}`);
  return meshJob ? jm.progress(meshJob.id) : null;
}

/* ----------------------------------------------------------- test helpers */

export function resetIdCounter(): void {
  idCounter = 0;
}

export function clearJobStore(): void {
  jobStore.clear();
  exportStore.clear();
  trainingJobManager = null;
}

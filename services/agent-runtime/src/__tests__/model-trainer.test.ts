// ---------------------------------------------------------------------------
// Model Trainer Engine — Tests
// ---------------------------------------------------------------------------

import {
  validateSamples,
  splitDataset,
  formatSampleForTraining,
  buildTrainingArgs,
  createTrainingJob,
  getTrainingJob,
  listTrainingJobs,
  cancelTrainingJob,
  recordMetrics,
  recordEvaluation,
  failTrainingJob,
  transitionJobStatus,
  registerExport,
  listExports,
  getTrainerStats,
  getRecipe,
  listRecipes,
  resetIdCounter,
  clearJobStore,
  DEFAULT_LORA_CONFIG,
  DEFAULT_TRAINING_CONFIG,
  TRAINING_RECIPES,
  type TrainingSample,
  type TrainingJob,
  type EvaluationResult,
} from '../model-trainer';

beforeEach(() => {
  resetIdCounter();
  clearJobStore();
});

/* ========================================================================== */
/* validateSamples                                                            */
/* ========================================================================== */

describe('validateSamples', () => {
  it('accepts valid samples', () => {
    const samples: TrainingSample[] = [
      { id: 's1', input: 'Hello world', output: 'Hi there!' },
      { id: 's2', input: 'What is TypeScript?', output: 'A typed superset of JavaScript.' },
    ];
    const { valid, errors } = validateSamples(samples);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('rejects samples with missing input', () => {
    const samples = [{ id: 's1', input: '', output: 'Some output' }] as TrainingSample[];
    const { valid, errors } = validateSamples(samples);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('missing or invalid input');
  });

  it('rejects samples with short output', () => {
    const samples: TrainingSample[] = [
      { id: 's1', input: 'Valid input text', output: 'Hi' },
    ];
    const { valid, errors } = validateSamples(samples);
    expect(valid).toHaveLength(0);
    expect(errors[0]).toContain('output too short');
  });

  it('keeps valid and reports invalid separately', () => {
    const samples: TrainingSample[] = [
      { id: 's1', input: 'Good input here', output: 'Good output here' },
      { id: 's2', input: 'Ok', output: 'Too' }, // both too short
    ];
    const { valid, errors } = validateSamples(samples);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});

/* ========================================================================== */
/* splitDataset                                                               */
/* ========================================================================== */

describe('splitDataset', () => {
  const samples: TrainingSample[] = Array.from({ length: 100 }, (_, i) => ({
    id: `s${i}`,
    input: `Input ${i} content`,
    output: `Output ${i} content`,
  }));

  it('splits with 0.9 ratio', () => {
    const { train, eval: evalSet } = splitDataset(samples, 0.9, 42);
    expect(train.length).toBe(90);
    expect(evalSet.length).toBe(10);
  });

  it('splits with 0.8 ratio', () => {
    const { train, eval: evalSet } = splitDataset(samples, 0.8, 42);
    expect(train.length).toBe(80);
    expect(evalSet.length).toBe(20);
  });

  it('is deterministic with same seed', () => {
    const a = splitDataset(samples, 0.9, 42);
    const b = splitDataset(samples, 0.9, 42);
    expect(a.train.map((s) => s.id)).toEqual(b.train.map((s) => s.id));
  });

  it('produces different splits with different seeds', () => {
    const a = splitDataset(samples, 0.9, 42);
    const b = splitDataset(samples, 0.9, 99);
    // Very unlikely to be identical
    const aIds = a.train.map((s) => s.id).join(',');
    const bIds = b.train.map((s) => s.id).join(',');
    expect(aIds).not.toBe(bIds);
  });

  it('clamps split ratio to 0.5–0.99', () => {
    const { train } = splitDataset(samples, 0.1, 42); // should clamp to 0.5
    expect(train.length).toBe(50);
  });
});

/* ========================================================================== */
/* formatSampleForTraining                                                    */
/* ========================================================================== */

describe('formatSampleForTraining', () => {
  const sample: TrainingSample = { id: 's1', input: 'Hello', output: 'Hi there' };

  it('formats as conversation', () => {
    const result = formatSampleForTraining(sample, 'conversation', 'You are helpful.');
    const parsed = JSON.parse(result);
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0].role).toBe('system');
    expect(parsed.messages[1].role).toBe('user');
    expect(parsed.messages[2].role).toBe('assistant');
  });

  it('formats as conversation without system prompt', () => {
    const result = formatSampleForTraining(sample, 'conversation');
    const parsed = JSON.parse(result);
    expect(parsed.messages).toHaveLength(2);
  });

  it('formats as instruction', () => {
    const result = formatSampleForTraining(sample, 'instruction');
    const parsed = JSON.parse(result);
    expect(parsed.instruction).toBe('Hello');
    expect(parsed.output).toBe('Hi there');
  });

  it('formats as completion', () => {
    const result = formatSampleForTraining(sample, 'completion');
    expect(result).toBe('Hello\nHi there');
  });

  it('formats as preference', () => {
    const result = formatSampleForTraining(sample, 'preference');
    const parsed = JSON.parse(result);
    expect(parsed.prompt).toBe('Hello');
    expect(parsed.chosen).toBe('Hi there');
    expect(parsed).toHaveProperty('rejected');
  });
});

/* ========================================================================== */
/* buildTrainingArgs                                                          */
/* ========================================================================== */

describe('buildTrainingArgs', () => {
  it('includes base model and output dir', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world!', output: 'Hi there!!' }],
    });
    const args = buildTrainingArgs(job);
    expect(args).toContain('--model_name_or_path');
    expect(args).toContain(job.config.baseModel);
    expect(args).toContain('--output_dir');
  });

  it('includes LoRA args for qlora method', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world!', output: 'Hi there!!' }],
    });
    const args = buildTrainingArgs(job);
    expect(args).toContain('--use_peft');
    expect(args).toContain('--lora_r');
    expect(args).toContain('--load_in_4bit');
  });

  it('includes bf16 flag by default', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world!', output: 'Hi there!!' }],
    });
    const args = buildTrainingArgs(job);
    expect(args).toContain('--bf16');
  });

  it('includes gradient checkpointing', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world!', output: 'Hi there!!' }],
    });
    const args = buildTrainingArgs(job);
    expect(args).toContain('--gradient_checkpointing');
  });

  it('includes max_steps when set', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      config: { maxSteps: 500 },
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world!', output: 'Hi there!!' }],
    });
    const args = buildTrainingArgs(job);
    expect(args).toContain('--max_steps');
    expect(args).toContain('500');
  });
});

/* ========================================================================== */
/* createTrainingJob                                                          */
/* ========================================================================== */

describe('createTrainingJob', () => {
  it('creates a job with defaults', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [
        { id: 's1', input: 'Hello world input', output: 'Hello world output' },
        { id: 's2', input: 'Second input data', output: 'Second output data' },
      ],
    });
    expect(job.id).toBeTruthy();
    expect(job.status).toBe('pending');
    expect(job.config.baseModel).toBe('Qwen/Qwen2.5-4B');
    expect(job.config.method).toBe('qlora');
    expect(job.sampleCount).toBe(2);
  });

  it('applies recipe config', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      recipe: 'writing_style',
      dataSources: [{ type: 'conversation_logs' }],
      samples: [{ id: 's1', input: 'Hello world input', output: 'Hello world output' }],
    });
    expect(job.recipe).toBe('writing_style');
    expect(job.config.epochs).toBe(3);
    expect(job.config.maxSeqLength).toBe(1024);
  });

  it('can be retrieved after creation', () => {
    const job = createTrainingJob({
      orgId: 'org1',
      dataSources: [{ type: 'inline' }],
      samples: [{ id: 's1', input: 'Hello world input', output: 'Hello world output' }],
    });
    const retrieved = getTrainingJob(job.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(job.id);
  });
});

/* ========================================================================== */
/* listTrainingJobs                                                           */
/* ========================================================================== */

describe('listTrainingJobs', () => {
  it('filters by orgId', () => {
    createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's2', input: 'Hello input', output: 'Hello output' }] });
    createTrainingJob({ orgId: 'org2', dataSources: [{ type: 'inline' }], samples: [{ id: 's3', input: 'Hello input', output: 'Hello output' }] });

    expect(listTrainingJobs('org1')).toHaveLength(2);
    expect(listTrainingJobs('org2')).toHaveLength(1);
  });

  it('filters by status', () => {
    const j1 = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's2', input: 'Hello input', output: 'Hello output' }] });
    cancelTrainingJob(j1.id);

    expect(listTrainingJobs('org1', 'cancelled')).toHaveLength(1);
    expect(listTrainingJobs('org1', 'pending')).toHaveLength(1);
  });
});

/* ========================================================================== */
/* cancelTrainingJob                                                          */
/* ========================================================================== */

describe('cancelTrainingJob', () => {
  it('cancels a pending job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(cancelTrainingJob(job.id)).toBe(true);
    expect(getTrainingJob(job.id)!.status).toBe('cancelled');
  });

  it('cannot cancel a completed job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    transitionJobStatus(job.id, 'preparing');
    transitionJobStatus(job.id, 'training');
    transitionJobStatus(job.id, 'evaluating');
    transitionJobStatus(job.id, 'completed');
    expect(cancelTrainingJob(job.id)).toBe(false);
  });

  it('returns false for non-existent job', () => {
    expect(cancelTrainingJob('nonexistent')).toBe(false);
  });
});

/* ========================================================================== */
/* transitionJobStatus                                                        */
/* ========================================================================== */

describe('transitionJobStatus', () => {
  it('follows valid transition chain', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(transitionJobStatus(job.id, 'preparing')).toBe(true);
    expect(transitionJobStatus(job.id, 'training')).toBe(true);
    expect(transitionJobStatus(job.id, 'evaluating')).toBe(true);
    expect(transitionJobStatus(job.id, 'completed')).toBe(true);
    expect(getTrainingJob(job.id)!.status).toBe('completed');
  });

  it('rejects invalid transitions', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(transitionJobStatus(job.id, 'completed')).toBe(false); // pending → completed not allowed
    expect(transitionJobStatus(job.id, 'training')).toBe(false); // pending → training not allowed
  });

  it('sets startedAt on training transition', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    transitionJobStatus(job.id, 'preparing');
    transitionJobStatus(job.id, 'training');
    expect(getTrainingJob(job.id)!.startedAt).toBeDefined();
  });

  it('returns false for non-existent job', () => {
    expect(transitionJobStatus('nope', 'preparing')).toBe(false);
  });
});

/* ========================================================================== */
/* recordMetrics                                                              */
/* ========================================================================== */

describe('recordMetrics', () => {
  it('records metrics for a training job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    transitionJobStatus(job.id, 'preparing');
    transitionJobStatus(job.id, 'training');

    const success = recordMetrics(job.id, {
      step: 10,
      epoch: 1,
      trainLoss: 2.5,
      learningRate: 2e-4,
      throughputSamplesPerSec: 15,
      gpuMemoryMb: 8000,
      elapsedMs: 5000,
    });

    expect(success).toBe(true);
    const updated = getTrainingJob(job.id)!;
    expect(updated.currentStep).toBe(10);
    expect(updated.metrics).toHaveLength(1);
    expect(updated.metrics[0].trainLoss).toBe(2.5);
  });

  it('rejects metrics for non-training job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(recordMetrics(job.id, {
      step: 1, epoch: 1, trainLoss: 3.0, learningRate: 2e-4,
      throughputSamplesPerSec: 10, gpuMemoryMb: 4000, elapsedMs: 1000,
    })).toBe(false); // still pending
  });
});

/* ========================================================================== */
/* recordEvaluation                                                           */
/* ========================================================================== */

describe('recordEvaluation', () => {
  it('records evaluation and completes job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });

    const evalResult: EvaluationResult = {
      baselineScore: 0.6,
      finetuneScore: 0.85,
      improvement: 41.7,
      perplexity: 5.2,
      humanEvalSamples: [],
    };

    const success = recordEvaluation(job.id, evalResult, '/tmp/adapter/job1');
    expect(success).toBe(true);

    const updated = getTrainingJob(job.id)!;
    expect(updated.status).toBe('completed');
    expect(updated.evaluation!.improvement).toBe(41.7);
    expect(updated.outputAdapterPath).toBe('/tmp/adapter/job1');
  });
});

/* ========================================================================== */
/* failTrainingJob                                                            */
/* ========================================================================== */

describe('failTrainingJob', () => {
  it('marks job as failed with error message', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(failTrainingJob(job.id, 'Out of memory')).toBe(true);
    expect(getTrainingJob(job.id)!.status).toBe('failed');
    expect(getTrainingJob(job.id)!.errorMessage).toBe('Out of memory');
  });

  it('returns false for non-existent job', () => {
    expect(failTrainingJob('nope', 'Error')).toBe(false);
  });
});

/* ========================================================================== */
/* registerExport                                                             */
/* ========================================================================== */

describe('registerExport', () => {
  it('registers export for completed job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    recordEvaluation(job.id, {
      baselineScore: 0.5, finetuneScore: 0.8, improvement: 60, perplexity: 4.0, humanEvalSamples: [],
    }, '/tmp/adapter');

    const exp = registerExport(job.id, '/tmp/adapter', 'custom-writing-v1');
    expect(exp).not.toBeNull();
    expect(exp!.litellmModelName).toBe('custom-writing-v1');
    expect(getTrainingJob(job.id)!.outputModelName).toBe('custom-writing-v1');
  });

  it('returns null for incomplete job', () => {
    const job = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    expect(registerExport(job.id, '/tmp/adapter', 'model-v1')).toBeNull();
  });
});

/* ========================================================================== */
/* listExports                                                                */
/* ========================================================================== */

describe('listExports', () => {
  it('returns all registered exports', () => {
    const j1 = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    const j2 = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's2', input: 'Hello input', output: 'Hello output' }] });

    recordEvaluation(j1.id, { baselineScore: 0.5, finetuneScore: 0.8, improvement: 60, perplexity: 4, humanEvalSamples: [] }, '/a');
    recordEvaluation(j2.id, { baselineScore: 0.5, finetuneScore: 0.8, improvement: 60, perplexity: 4, humanEvalSamples: [] }, '/b');

    registerExport(j1.id, '/a', 'model-a');
    registerExport(j2.id, '/b', 'model-b');

    expect(listExports()).toHaveLength(2);
  });
});

/* ========================================================================== */
/* getTrainerStats                                                            */
/* ========================================================================== */

describe('getTrainerStats', () => {
  it('returns zeroed stats when empty', () => {
    const stats = getTrainerStats();
    expect(stats.totalJobs).toBe(0);
    expect(stats.activeJobs).toBe(0);
    expect(stats.completedJobs).toBe(0);
    expect(stats.failedJobs).toBe(0);
  });

  it('counts jobs correctly', () => {
    const j1 = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's1', input: 'Hello input', output: 'Hello output' }] });
    const j2 = createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's2', input: 'Hello input', output: 'Hello output' }] });
    createTrainingJob({ orgId: 'org1', dataSources: [{ type: 'inline' }], samples: [{ id: 's3', input: 'Hello input', output: 'Hello output' }] });

    recordEvaluation(j1.id, { baselineScore: 0.5, finetuneScore: 0.8, improvement: 60, perplexity: 4, humanEvalSamples: [] }, '/a');
    failTrainingJob(j2.id, 'OOM');

    const stats = getTrainerStats();
    expect(stats.totalJobs).toBe(3);
    expect(stats.completedJobs).toBe(1);
    expect(stats.failedJobs).toBe(1);
  });
});

/* ========================================================================== */
/* Recipes                                                                    */
/* ========================================================================== */

describe('recipes', () => {
  it('has 3 built-in recipes', () => {
    expect(TRAINING_RECIPES).toHaveLength(3);
  });

  it('getRecipe returns writing_style', () => {
    const recipe = getRecipe('writing_style');
    expect(recipe).toBeDefined();
    expect(recipe!.name).toBe('Writing Style Adaptation');
  });

  it('getRecipe returns undefined for nonexistent', () => {
    expect(getRecipe('nonexistent' as any)).toBeUndefined();
  });

  it('listRecipes returns all recipes', () => {
    expect(listRecipes()).toHaveLength(3);
  });

  it('each recipe has evaluation prompts', () => {
    for (const recipe of TRAINING_RECIPES) {
      expect(recipe.evaluationPrompts.length).toBeGreaterThan(0);
    }
  });
});

/* ========================================================================== */
/* Constants                                                                  */
/* ========================================================================== */

describe('DEFAULT_LORA_CONFIG', () => {
  it('has rank 16', () => {
    expect(DEFAULT_LORA_CONFIG.rank).toBe(16);
  });

  it('has QLoRA 4-bit by default', () => {
    expect(DEFAULT_LORA_CONFIG.quantBits).toBe(4);
  });

  it('targets standard modules', () => {
    expect(DEFAULT_LORA_CONFIG.targetModules).toContain('q_proj');
    expect(DEFAULT_LORA_CONFIG.targetModules).toContain('v_proj');
  });
});

describe('DEFAULT_TRAINING_CONFIG', () => {
  it('uses Qwen2.5-4B as base model', () => {
    expect(DEFAULT_TRAINING_CONFIG.baseModel).toBe('Qwen/Qwen2.5-4B');
  });

  it('uses qlora method', () => {
    expect(DEFAULT_TRAINING_CONFIG.method).toBe('qlora');
  });

  it('has 4-hour timeout', () => {
    expect(DEFAULT_TRAINING_CONFIG.timeoutMs).toBe(4 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// Tests for remaining backend items:
//   G.1.4 — Qwen3 fleet deployment manifest
//   B.1.8 — Evolution engine parallel workers via compute-mesh
//   H.1.6 — Training job scheduling via compute-mesh
// ---------------------------------------------------------------------------

import {
  FLEET_NODES,
  QWEN3_ASSIGNMENTS,
  QWEN3_MOE_ALTERNATIVE,
  QWEN3_14B_ALTERNATIVE,
  generateDeployPlan,
  formatFleetSummary,
} from '@sven/model-router/deploy/qwen3-fleet';

import {
  mergeConfig,
  getRun,
  startEvolution,
  stopEvolution,
  runEvolution,
  getBestNode,
  listEvolutionMeshJobs,
  getEvolutionMeshProgress,
  getEvolutionJobManager,
  setEvolutionJobManager,
  getEvolutionStats,
  resetIdCounter as resetEvolution,
  type EvolutionLLMProvider,
  type Evaluator,
  type ExperimentTemplate,
} from '../evolution-engine';

import {
  createTrainingJob,
  getTrainingJob,
  cancelTrainingJob,
  clearJobStore as clearTrainer,
  resetIdCounter as resetTrainer,
  scheduleTrainingOnMesh,
  estimateTrainingResources,
  listTrainingMeshJobs,
  getTrainingMeshProgress,
  getTrainingJobManager,
  setTrainingJobManager,
} from '../model-trainer';

import { JobManager } from '@sven/compute-mesh';

/* ================================================================ */
/* § G.1.4 — Qwen3 Fleet Deployment Manifest                        */
/* ================================================================ */

describe('G.1.4 — Qwen3 Fleet Deployment Manifest', () => {
  test('FLEET_NODES has all 3 cluster nodes', () => {
    expect(FLEET_NODES).toHaveLength(3);
    const ids = FLEET_NODES.map((n) => n.nodeId);
    expect(ids).toContain('vm5');
    expect(ids).toContain('vm13');
    expect(ids).toContain('s24');
  });

  test('VM5 node is configured as primary with llama-server', () => {
    const vm5 = FLEET_NODES.find((n) => n.nodeId === 'vm5')!;
    expect(vm5.hostname).toBe('sven-ai');
    expect(vm5.ip).toBe('10.47.47.9');
    expect(vm5.totalVramMb).toBe(28_672);
    expect(vm5.target).toBe('llama-server');
    expect(vm5.role).toBe('primary');
  });

  test('VM13 node is configured as fast with Ollama', () => {
    const vm13 = FLEET_NODES.find((n) => n.nodeId === 'vm13')!;
    expect(vm13.hostname).toBe('kaldorei');
    expect(vm13.totalVramMb).toBe(12_288);
    expect(vm13.target).toBe('ollama');
    expect(vm13.role).toBe('fast');
  });

  test('S24 node is configured as mobile', () => {
    const s24 = FLEET_NODES.find((n) => n.nodeId === 's24')!;
    expect(s24.role).toBe('mobile');
    expect(s24.totalVramMb).toBe(4_096);
    expect(s24.endpoint).toBe('');
  });

  test('QWEN3_ASSIGNMENTS maps 3 models to 3 nodes', () => {
    expect(QWEN3_ASSIGNMENTS).toHaveLength(3);
    const nodeIds = QWEN3_ASSIGNMENTS.map((a) => a.nodeId);
    expect(nodeIds).toEqual(['vm5', 'vm13', 's24']);
  });

  test('VM5 gets Qwen3-32B Q4_K_M flagship', () => {
    const a = QWEN3_ASSIGNMENTS.find((a) => a.nodeId === 'vm5')!;
    expect(a.parameterCountB).toBe(32);
    expect(a.quantLevel).toBe('Q4_K_M');
    expect(a.estimatedVramMb).toBe(18_432);
    expect(a.llamaServerArgs).toBeDefined();
    expect(a.llamaServerArgs).toContain('--tensor-split');
  });

  test('VM13 gets Qwen3-8B via Ollama', () => {
    const a = QWEN3_ASSIGNMENTS.find((a) => a.nodeId === 'vm13')!;
    expect(a.parameterCountB).toBe(8);
    expect(a.ollamaTag).toBe('qwen3:8b');
  });

  test('S24 gets Qwen3-4B Q4_K_M for mobile', () => {
    const a = QWEN3_ASSIGNMENTS.find((a) => a.nodeId === 's24')!;
    expect(a.parameterCountB).toBe(4);
    expect(a.quantLevel).toBe('Q4_K_M');
    expect(a.estimatedVramMb).toBe(2_048);
  });

  test('MoE alternative is defined for VM5', () => {
    expect(QWEN3_MOE_ALTERNATIVE.nodeId).toBe('vm5');
    expect(QWEN3_MOE_ALTERNATIVE.parameterCountB).toBe(30);
    expect(QWEN3_MOE_ALTERNATIVE.modelFamily).toBe('qwen3-moe');
  });

  test('14B alternative is defined for VM13', () => {
    expect(QWEN3_14B_ALTERNATIVE.nodeId).toBe('vm13');
    expect(QWEN3_14B_ALTERNATIVE.parameterCountB).toBe(14);
    expect(QWEN3_14B_ALTERNATIVE.quantLevel).toBe('Q4_K_M');
  });

  test('generateDeployPlan produces valid plan with all assignments', () => {
    const plan = generateDeployPlan();
    expect(plan.totalModels).toBe(3);
    expect(plan.totalVramUsedMb).toBeGreaterThan(0);
    expect(plan.totalVramAvailableMb).toBe(28_672 + 12_288 + 4_096);
    expect(plan.utilizationPct).toBeGreaterThan(0);
    expect(plan.utilizationPct).toBeLessThanOrEqual(100);
  });

  test('generateDeployPlan warns on oversized assignments', () => {
    const oversized = [{ ...QWEN3_ASSIGNMENTS[0], estimatedVramMb: 99_999 }];
    const plan = generateDeployPlan(oversized);
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings[0]).toContain('exceeds');
  });

  test('formatFleetSummary produces readable markdown', () => {
    const plan = generateDeployPlan();
    const summary = formatFleetSummary(plan);
    expect(summary).toContain('Qwen3 Fleet Deployment Plan');
    expect(summary).toContain('sven-ai');
    expect(summary).toContain('kaldorei');
    expect(summary).toContain('GiB');
  });
});


/* ================================================================ */
/* § B.1.8 — Evolution Engine Parallel Workers                       */
/* ================================================================ */

describe('B.1.8 — Evolution Parallel Workers via Compute-Mesh', () => {
  beforeEach(() => {
    resetEvolution();
    setEvolutionJobManager(new JobManager());
  });

  const mockProvider: EvolutionLLMProvider = {
    complete: async () => ({ text: 'function improved() { return 0.8; }' }),
  };

  const mockEvaluator: Evaluator = async () => ({
    score: 0.75 + Math.random() * 0.2,
    metrics: { accuracy: 0.8, latency: 100 },
  });

  const baseExperiment: ExperimentTemplate = {
    domain: 'custom',
    name: 'test',
    description: 'test parallel workers',
    evaluatorCode: '',
    baselineCode: 'function() { return 0.5; }',
    cognitionSeeds: ['seed'],
    config: {},
  };

  test('getEvolutionJobManager returns singleton', () => {
    const jm1 = getEvolutionJobManager();
    const jm2 = getEvolutionJobManager();
    expect(jm1).toBe(jm2);
  });

  test('setEvolutionJobManager replaces instance', () => {
    const custom = new JobManager();
    setEvolutionJobManager(custom);
    expect(getEvolutionJobManager()).toBe(custom);
  });

  test('parallel config merges with parallelWorkers > 1', () => {
    const config = mergeConfig({ parallelWorkers: 4 });
    expect(config.parallelWorkers).toBe(4);
  });

  test('runEvolution with parallelWorkers=1 uses sequential path', async () => {
    const run = startEvolution({
      orgId: 'org-1',
      experiment: baseExperiment,
      config: { maxGenerations: 1, populationSize: 2, parallelWorkers: 1 },
    });
    const result = await runEvolution(run, mockProvider, mockEvaluator);
    expect(result.status).toBe('completed');
    expect(result.totalEvaluations).toBeGreaterThanOrEqual(2);
  });

  test('runEvolution with parallelWorkers=3 uses mesh job path', async () => {
    const run = startEvolution({
      orgId: 'org-1',
      experiment: baseExperiment,
      config: { maxGenerations: 2, populationSize: 3, parallelWorkers: 3 },
    });
    const result = await runEvolution(run, mockProvider, mockEvaluator);
    expect(result.status).toBe('completed');
    // 2 generations × 3 workers = 6 evaluations (minimum)
    expect(result.totalEvaluations).toBeGreaterThanOrEqual(6);
  });

  test('listEvolutionMeshJobs returns jobs from parallel runs', async () => {
    const run = startEvolution({
      orgId: 'org-1',
      experiment: baseExperiment,
      config: { maxGenerations: 1, populationSize: 2, parallelWorkers: 2 },
    });
    await runEvolution(run, mockProvider, mockEvaluator);

    const jobs = listEvolutionMeshJobs();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].name).toContain('evolution-');
  });

  test('parallel workers handle individual failures gracefully', async () => {
    let callCount = 0;
    const flakyEvaluator: Evaluator = async () => {
      callCount++;
      if (callCount % 3 === 0) throw new Error('Simulated failure');
      return { score: 0.7, metrics: { accuracy: 0.7 } };
    };

    const run = startEvolution({
      orgId: 'org-1',
      experiment: baseExperiment,
      config: { maxGenerations: 2, populationSize: 3, parallelWorkers: 3 },
    });
    const result = await runEvolution(run, mockProvider, flakyEvaluator);
    // Should complete despite some worker failures
    expect(['completed', 'failed']).toContain(result.status);
    expect(result.totalEvaluations).toBeGreaterThan(0);
  });
});

/* ================================================================ */
/* § H.1.6 — Training Job Scheduling via Compute-Mesh               */
/* ================================================================ */

describe('H.1.6 — Training Job Scheduling via Compute-Mesh', () => {
  beforeEach(() => {
    clearTrainer();
    resetTrainer();
    setTrainingJobManager(new JobManager());
  });

  function makeJob(overrides?: Record<string, unknown>) {
    return createTrainingJob({
      orgId: 'org-1',
      dataSources: [{ type: 'inline', data: [
        { id: 's1', input: 'What is TypeScript?', output: 'A typed superset of JavaScript.' },
        { id: 's2', input: 'What is Rust?', output: 'A systems programming language.' },
        { id: 's3', input: 'What is Go?', output: 'A statically typed language by Google.' },
        { id: 's4', input: 'What is Python?', output: 'A dynamic programming language.' },
        { id: 's5', input: 'What is Kotlin?', output: 'A modern JVM language by JetBrains.' },
      ] }],
      samples: [
        { id: 's1', input: 'What is TypeScript?', output: 'A typed superset of JavaScript.' },
        { id: 's2', input: 'What is Rust?', output: 'A systems programming language.' },
        { id: 's3', input: 'What is Go?', output: 'A statically typed language by Google.' },
        { id: 's4', input: 'What is Python?', output: 'A dynamic programming language.' },
        { id: 's5', input: 'What is Kotlin?', output: 'A modern JVM language by JetBrains.' },
      ],
      ...overrides,
    });
  }

  test('getTrainingJobManager returns singleton', () => {
    const jm1 = getTrainingJobManager();
    const jm2 = getTrainingJobManager();
    expect(jm1).toBe(jm2);
  });

  test('estimateTrainingResources for QLoRA 4B model', () => {
    const job = makeJob();
    const reqs = estimateTrainingResources(job);
    expect(reqs.requiresGpu).toBe(true);
    expect(reqs.minVramMb).toBeGreaterThan(0);
    expect(reqs.minRamMb).toBeGreaterThanOrEqual(4096);
    expect(reqs.minCpuCores).toBeGreaterThanOrEqual(2);
    expect(reqs.requiredRuntimes).toContain('python');
    expect(reqs.requiredRuntimes).toContain('pytorch');
  });

  test('estimateTrainingResources scales with model size', () => {
    const small = makeJob({ config: { baseModel: 'Qwen/Qwen2.5-4B', method: 'qlora' } });
    const large = makeJob({ config: { baseModel: 'Qwen/Qwen2.5-32B', method: 'qlora' } });
    const smallReqs = estimateTrainingResources(small);
    const largeReqs = estimateTrainingResources(large);
    expect(largeReqs.minVramMb).toBeGreaterThan(smallReqs.minVramMb);
  });

  test('estimateTrainingResources requires more VRAM for full fine-tune', () => {
    const qlora = makeJob({ config: { method: 'qlora' } });
    const full = makeJob({ config: { method: 'full' } });
    const qloraReqs = estimateTrainingResources(qlora);
    const fullReqs = estimateTrainingResources(full);
    expect(fullReqs.minVramMb).toBeGreaterThan(qloraReqs.minVramMb);
  });

  test('scheduleTrainingOnMesh creates mesh job and transitions to preparing', () => {
    const job = makeJob();
    expect(job.status).toBe('pending');

    const meshJob = scheduleTrainingOnMesh({ jobId: job.id });
    expect(meshJob).not.toBeNull();
    expect(meshJob!.name).toBe(`training-${job.id}`);
    expect(meshJob!.strategy).toBe('pipeline');
    expect(meshJob!.workUnits).toHaveLength(4); // prepare, train, evaluate, export
    expect(meshJob!.sensitivityLevel).toBe('confidential');

    // Training job should now be 'preparing'
    const updated = getTrainingJob(job.id)!;
    expect(updated.status).toBe('preparing');
  });

  test('scheduleTrainingOnMesh rejects non-pending jobs', () => {
    const job = makeJob();
    cancelTrainingJob(job.id);
    const meshJob = scheduleTrainingOnMesh({ jobId: job.id });
    expect(meshJob).toBeNull();
  });

  test('scheduleTrainingOnMesh rejects unknown job IDs', () => {
    const meshJob = scheduleTrainingOnMesh({ jobId: 'nonexistent' });
    expect(meshJob).toBeNull();
  });

  test('scheduleTrainingOnMesh creates pipeline with correct stage payloads', () => {
    const job = makeJob();
    const meshJob = scheduleTrainingOnMesh({ jobId: job.id })!;

    const stages = meshJob.workUnits.map((u) => u.payload.stage);
    expect(stages).toEqual(['prepare', 'train', 'evaluate', 'export']);

    const trainUnit = meshJob.workUnits.find((u) => u.payload.stage === 'train')!;
    expect(trainUnit.payload.action).toBe('lora_finetune');
    expect(trainUnit.payload.baseModel).toBe(job.config.baseModel);
  });

  test('scheduleTrainingOnMesh respects priority override', () => {
    const job = makeJob();
    const meshJob = scheduleTrainingOnMesh({ jobId: job.id, priority: 9 })!;
    expect(meshJob.priority).toBe(9);
  });

  test('listTrainingMeshJobs returns training jobs only', () => {
    const job = makeJob();
    scheduleTrainingOnMesh({ jobId: job.id });
    const meshJobs = listTrainingMeshJobs();
    expect(meshJobs.length).toBeGreaterThan(0);
    expect(meshJobs[0].name).toContain('training-');
  });

  test('getTrainingMeshProgress returns progress for scheduled job', () => {
    const job = makeJob();
    scheduleTrainingOnMesh({ jobId: job.id });
    const progress = getTrainingMeshProgress(job.id);
    expect(progress).not.toBeNull();
    expect(progress!.total).toBe(4);
    expect(progress!.pending).toBe(4);
    expect(progress!.progressPct).toBe(0);
  });

  test('getTrainingMeshProgress returns null for unscheduled job', () => {
    const progress = getTrainingMeshProgress('nonexistent');
    expect(progress).toBeNull();
  });

  test('federation defaults to false for confidential training data', () => {
    const job = makeJob();
    const meshJob = scheduleTrainingOnMesh({ jobId: job.id })!;
    expect(meshJob.federationAllowed).toBe(false);
  });
});

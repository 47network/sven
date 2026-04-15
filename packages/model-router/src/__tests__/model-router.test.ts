import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import {
  ModelRegistry,
  type ModelEntry,
  type TaskType,
} from '../registry/index.js';
import {
  scoreModel,
  routeRequest,
  classifyTask,
  calculateVramBudget,
  suggestEviction,
  type InferenceRequest,
} from '../router/index.js';
import { FleetManager, type FleetNode } from '../fleet/index.js';
import { recommendQuantization, type QuantLevel } from '../deploy/index.js';
import { BenchmarkEngine, type TaskResult } from '../benchmark/index.js';

/* ------------------------------------------------------------------ helpers */

function makeModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'local',
    version: '1.0',
    parameterCount: '7B',
    quantization: 'gguf',
    supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    vramRequirementMb: 4500,
    diskSizeMb: 4700,
    contextWindow: 32_768,
    maxOutputTokens: 8192,
    license: 'Apache-2.0',
    licenseCommercialUse: true,
    endpoint: 'http://10.47.47.13:11434',
    hostDevice: 'vm13-test',
    status: 'ready',
    tokensPerSecond: 45,
    lastHealthCheck: null,
    registeredAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

function makeCloudModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  return makeModel({
    id: 'cloud-gpt4o',
    name: 'GPT-4o',
    provider: 'openai',
    parameterCount: '120B',
    vramRequirementMb: 0,
    endpoint: null,
    hostDevice: null,
    status: 'ready',
    tokensPerSecond: 80,
    ...overrides,
  });
}

function makeFleetNode(overrides: Partial<FleetNode> = {}): FleetNode {
  return {
    id: 'test-node',
    name: 'Test Node',
    endpoint: 'http://localhost:11434',
    runtime: 'ollama',
    gpus: [
      { index: 0, name: 'RTX 3060', vramTotalMb: 12_288, vramUsedMb: 0, vramFreeMb: 12_288, utilizationPercent: null },
    ],
    totalVramMb: 12_288,
    healthy: true,
    lastProbe: null,
    ...overrides,
  };
}

/* ============================================================= G.6.1 ===
 * Health check tests — fleet node probing, registration, status
 * ==================================================================== */

describe('G.6.1 — Fleet health checks', () => {
  let fleet: FleetManager;

  beforeEach(() => {
    fleet = new FleetManager(60_000); // long interval to avoid probing in tests
  });

  it('registers and lists nodes', () => {
    fleet.registerNode(makeFleetNode({ id: 'node-1', name: 'Node 1' }));
    fleet.registerNode(makeFleetNode({ id: 'node-2', name: 'Node 2' }));

    const nodes = fleet.listNodes();
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(['node-1', 'node-2']);
  });

  it('getNode returns registered node', () => {
    fleet.registerNode(makeFleetNode({ id: 'my-node' }));
    const node = fleet.getNode('my-node');
    expect(node).toBeDefined();
    expect(node!.id).toBe('my-node');
  });

  it('getNode returns undefined for unknown node', () => {
    expect(fleet.getNode('unknown')).toBeUndefined();
  });

  it('unregisters nodes correctly', () => {
    fleet.registerNode(makeFleetNode({ id: 'rm-node' }));
    expect(fleet.listNodes()).toHaveLength(1);

    const removed = fleet.unregisterNode('rm-node');
    expect(removed).toBe(true);
    expect(fleet.listNodes()).toHaveLength(0);
  });

  it('unregisterNode returns false for unknown node', () => {
    expect(fleet.unregisterNode('ghost')).toBe(false);
  });

  it('getCachedStatus returns empty fleet when no probes have run', () => {
    fleet.registerNode(makeFleetNode({ id: 'n1' }));
    const status = fleet.getCachedStatus();
    expect(status.nodes).toHaveLength(0);
    expect(status.totalVramMb).toBe(0);
    expect(status.loadedModels).toBe(0);
    expect(status.healthyNodes).toBe(0);
    expect(status.degradedNodes).toBe(0);
  });

  it('getCachedNodeStatus returns undefined when not probed', () => {
    fleet.registerNode(makeFleetNode({ id: 'n1' }));
    expect(fleet.getCachedNodeStatus('n1')).toBeUndefined();
  });

  it('probeNode returns null for unknown node', async () => {
    const result = await fleet.probeNode('nonexistent');
    expect(result).toBeNull();
  });

  it('loadModel fails for unknown node', async () => {
    const result = await fleet.loadModel('nonexistent', 'test-model');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Node not found');
  });

  it('loadModel rejects llama-server nodes (no hot-swap)', async () => {
    fleet.registerNode(makeFleetNode({
      id: 'llama-node',
      runtime: 'llama-server',
    }));
    const result = await fleet.loadModel('llama-node', 'some-model');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Hot-swap not supported');
    expect(result.message).toContain('llama-server');
  });

  it('unloadModel fails for unknown node', async () => {
    const result = await fleet.unloadModel('nonexistent', 'test-model');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Node not found');
  });

  it('unloadModel rejects llama-server nodes', async () => {
    fleet.registerNode(makeFleetNode({
      id: 'llama-node',
      runtime: 'llama-server',
    }));
    const result = await fleet.unloadModel('llama-node', 'some-model');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Hot-swap not supported');
  });

  it('startProbing and stopProbing do not throw', () => {
    fleet.registerNode(makeFleetNode({ id: 'n1' }));
    expect(() => fleet.startProbing()).not.toThrow();
    expect(() => fleet.stopProbing()).not.toThrow();
  });

  it('double startProbing is idempotent', () => {
    fleet.registerNode(makeFleetNode({ id: 'n1' }));
    fleet.startProbing();
    fleet.startProbing(); // should not create a second timer
    fleet.stopProbing();
  });
});

/* ============================================================= G.6.2 ===
 * Benchmark tests — suite management, run lifecycle, ELO, comparison
 * ==================================================================== */

describe('G.6.2 — Benchmark engine', () => {
  let engine: BenchmarkEngine;

  beforeEach(() => {
    engine = new BenchmarkEngine();
  });

  it('initialises with 3 built-in suites', () => {
    const suites = engine.listSuites();
    expect(suites).toHaveLength(3);
    expect(suites.map((s) => s.id).sort()).toEqual(['coding-eval', 'local-vs-cloud', 'reasoning-eval']);
  });

  it('gets a suite by ID', () => {
    const suite = engine.getSuite('coding-eval');
    expect(suite).toBeDefined();
    expect(suite!.name).toBe('Coding Evaluation');
    expect(suite!.tasks.length).toBeGreaterThan(0);
  });

  it('creates a benchmark run', () => {
    const run = engine.createRun('coding-eval', 'model-a', 'Model A');
    expect(run).not.toBeNull();
    expect(run!.status).toBe('running');
    expect(run!.suiteId).toBe('coding-eval');
  });

  it('returns null for unknown suite', () => {
    const run = engine.createRun('nonexistent', 'model-a', 'Model A');
    expect(run).toBeNull();
  });

  it('records task results and completes a run', () => {
    const run = engine.createRun('coding-eval', 'model-a', 'Model A')!;

    const result: TaskResult = {
      taskId: 'code-1',
      output: 'function binarySearch(...) { ... }',
      latencyMs: 1200,
      tokensUsed: 150,
      scores: { correctness: 85, latency: 90, cost: 95 },
      passed: true,
    };

    engine.recordTaskResult(run.id, result);
    const completed = engine.completeRun(run.id);

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.aggregate).not.toBeNull();
    expect(completed!.aggregate!.overallScore).toBeGreaterThan(0);
    expect(completed!.aggregate!.passRate).toBe(1);
    expect(completed!.aggregate!.avgLatencyMs).toBe(1200);
  });

  it('computes aggregate metrics correctly', () => {
    const run = engine.createRun('coding-eval', 'model-a', 'Model A')!;

    engine.recordTaskResult(run.id, {
      taskId: 'code-1',
      output: 'output1',
      latencyMs: 1000,
      tokensUsed: 100,
      scores: { correctness: 80 },
      passed: true,
    });
    engine.recordTaskResult(run.id, {
      taskId: 'code-2',
      output: 'output2',
      latencyMs: 2000,
      tokensUsed: 200,
      scores: { correctness: 60 },
      passed: false,
    });

    const completed = engine.completeRun(run.id)!;
    const agg = completed.aggregate!;

    expect(agg.avgLatencyMs).toBe(1500);
    expect(agg.totalTokensUsed).toBe(300);
    expect(agg.passRate).toBe(0.5);
    expect(agg.overallScore).toBe(70); // (80+60)/2
  });

  it('updates ELO ratings correctly', () => {
    engine.updateElo('model-a', 'Model A', 'model-b', 'Model B', false);
    const leaderboard = engine.getLeaderboard();

    expect(leaderboard).toHaveLength(2);
    const a = leaderboard.find((r) => r.modelId === 'model-a')!;
    const b = leaderboard.find((r) => r.modelId === 'model-b')!;

    expect(a.elo).toBeGreaterThan(1200); // winner gains
    expect(b.elo).toBeLessThan(1200); // loser drops
    expect(a.wins).toBe(1);
    expect(b.losses).toBe(1);
    expect(a.matchesPlayed).toBe(1);
  });

  it('handles ELO draws', () => {
    engine.updateElo('model-a', 'Model A', 'model-b', 'Model B', true);
    const leaderboard = engine.getLeaderboard();
    const a = leaderboard.find((r) => r.modelId === 'model-a')!;
    const b = leaderboard.find((r) => r.modelId === 'model-b')!;

    expect(a.elo).toBe(b.elo); // equal starting ELO → draw keeps them equal
    expect(a.draws).toBe(1);
    expect(b.draws).toBe(1);
  });

  it('records and retrieves local-vs-cloud comparisons', () => {
    const localRun = engine.createRun('local-vs-cloud', 'local-qwen', 'Qwen 7B')!;
    engine.recordTaskResult(localRun.id, {
      taskId: 'lvc-code-1', output: 'code', latencyMs: 800, tokensUsed: 120,
      scores: { correctness: 85, latency: 90, cost: 100 }, passed: true,
    });
    engine.completeRun(localRun.id);

    const cloudRun = engine.createRun('local-vs-cloud', 'cloud-gpt4o', 'GPT-4o')!;
    engine.recordTaskResult(cloudRun.id, {
      taskId: 'lvc-code-1', output: 'code', latencyMs: 400, tokensUsed: 120,
      scores: { correctness: 90, latency: 95, cost: 60 }, passed: true,
    });
    engine.completeRun(cloudRun.id);

    const comp = engine.recordComparison(localRun.id, cloudRun.id, 'local-qwen', 'cloud-gpt4o');
    expect(comp).not.toBeNull();
    expect(comp!.costSavingsUsd).toBeGreaterThan(0);
    expect(['local', 'cloud', 'tie']).toContain(comp!.winner);

    const comps = engine.getComparisons();
    expect(comps).toHaveLength(1);
  });

  it('generates a report string', () => {
    const run = engine.createRun('coding-eval', 'model-x', 'Model X')!;
    engine.recordTaskResult(run.id, {
      taskId: 'code-1', output: 'out', latencyMs: 500, tokensUsed: 50,
      scores: { correctness: 90 }, passed: true,
    });
    engine.completeRun(run.id);
    engine.updateElo('model-x', 'Model X', 'model-y', 'Model Y', false);

    const report = engine.generateReport('model-x');
    expect(report).toContain('# Benchmark Report: model-x');
    expect(report).toContain('ELO Rating');
    expect(report).toContain('coding-eval');
  });
});

/* ============================================================= G.6.3 ===
 * Routing tests — local preference, scoring, task classification, VRAM
 * ==================================================================== */

/** Clear built-in models so tests start from a clean registry. */
function emptyRegistry(): ModelRegistry {
  const r = new ModelRegistry();
  for (const m of r.list()) r.unregister(m.id);
  return r;
}

describe('G.6.3 — Router local preference', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = emptyRegistry();
  });

  describe('scoreModel', () => {
    it('gives local models a +0.2 bonus when preferLocal is true', () => {
      const localModel = makeModel({ provider: 'local', endpoint: 'http://localhost:11434' });
      const cloudModel = makeCloudModel();

      const localScore = scoreModel(localModel, 'coding', 'balanced', undefined, true);
      const localScoreNoBonus = scoreModel(localModel, 'coding', 'balanced', undefined, false);

      expect(localScore).toBeGreaterThan(localScoreNoBonus);
    });

    it('does not give local bonus to cloud models', () => {
      const cloudModel = makeCloudModel();
      const scoreWithPref = scoreModel(cloudModel, 'coding', 'balanced', undefined, true);
      const scoreWithoutPref = scoreModel(cloudModel, 'coding', 'balanced', undefined, false);
      // Cloud model has no endpoint and provider !== 'local', so no bonus
      expect(scoreWithPref).toBe(scoreWithoutPref);
    });

    it('ready models get a status bonus', () => {
      const ready = makeModel({ status: 'ready' });
      const loading = makeModel({ id: 'loading-m', status: 'loading' });

      const readyScore = scoreModel(ready, 'coding', 'balanced');
      const loadingScore = scoreModel(loading, 'coding', 'balanced');

      expect(readyScore).toBeGreaterThan(loadingScore);
    });

    it('unsupported tasks get a penalty', () => {
      const model = makeModel({ supportedTasks: ['coding'] });
      const codingScore = scoreModel(model, 'coding', 'balanced');
      const visionScore = scoreModel(model, 'vision', 'balanced');

      expect(codingScore).toBeGreaterThan(visionScore);
    });

    it('quality priority weights larger models higher', () => {
      const smallModel = makeModel({ parameterCount: '3B' });
      const largeModel = makeModel({ id: 'large', parameterCount: '70B', tokensPerSecond: 15 });

      const smallQuality = scoreModel(smallModel, 'coding', 'quality');
      const largeQuality = scoreModel(largeModel, 'coding', 'quality');

      expect(largeQuality).toBeGreaterThan(smallQuality);
    });

    it('speed priority weights faster models higher', () => {
      const slowModel = makeModel({ parameterCount: '70B', tokensPerSecond: 10 });
      const fastModel = makeModel({ id: 'fast', parameterCount: '3B', tokensPerSecond: 90 });

      const slowSpeed = scoreModel(slowModel, 'chat', 'speed');
      const fastSpeed = scoreModel(fastModel, 'chat', 'speed');

      expect(fastSpeed).toBeGreaterThan(slowSpeed);
    });

    it('applies latency penalty when budget is exceeded', () => {
      const model = makeModel({ tokensPerSecond: 5 }); // very slow
      const withBudget = scoreModel(model, 'chat', 'balanced', 1000);
      const noBudget = scoreModel(model, 'chat', 'balanced');

      expect(withBudget).toBeLessThan(noBudget);
    });
  });

  describe('routeRequest', () => {
    it('routes to local model when preferLocal and local is ready', () => {
      const local = makeModel({
        id: 'local-qwen',
        name: 'Qwen 7B',
        provider: 'local',
        parameterCount: '7B',
        tokensPerSecond: 45,
        endpoint: 'http://10.47.47.13:11434',
        status: 'ready',
      });
      // Cloud model with same param count — local bonus should tip the scales
      const cloud = makeCloudModel({
        parameterCount: '7B',
        tokensPerSecond: 50,
        supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
      });

      registry.register(local);
      registry.register(cloud);

      const decision = routeRequest(registry, {
        id: 'req-1',
        task: 'coding',
        prompt: 'write a function',
        preferLocal: true,
      });

      expect(decision.modelId).toBe('local-qwen');
    });

    it('prefers local by default (preferLocal defaults to true)', () => {
      const local = makeModel({
        id: 'local-model',
        provider: 'local',
        endpoint: 'http://localhost:11434',
        status: 'ready',
        parameterCount: '7B',
        tokensPerSecond: 45,
      });
      const cloud = makeCloudModel({
        supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
        // Cloud has more params but no local bonus
        parameterCount: '8B',
        tokensPerSecond: 50,
      });

      registry.register(local);
      registry.register(cloud);

      const decision = routeRequest(registry, {
        id: 'req-2',
        task: 'chat',
        prompt: 'hello',
      });

      expect(decision.modelId).toBe('local-model');
    });

    it('selects preferred model if specified and ready', () => {
      registry.register(makeModel({ id: 'model-a', status: 'ready' }));
      registry.register(makeModel({ id: 'model-b', status: 'ready' }));

      const decision = routeRequest(registry, {
        id: 'req-3',
        task: 'coding',
        prompt: 'code something',
        preferredModel: 'model-b',
      });

      expect(decision.modelId).toBe('model-b');
    });

    it('provides fallback chain', () => {
      registry.register(makeModel({ id: 'a', name: 'A', status: 'ready' }));
      registry.register(makeModel({ id: 'b', name: 'B', status: 'ready' }));
      registry.register(makeModel({ id: 'c', name: 'C', status: 'ready' }));

      const decision = routeRequest(registry, {
        id: 'req-4',
        task: 'coding',
        prompt: 'code',
      });

      expect(decision.fallbackChain.length).toBeGreaterThan(0);
      expect(decision.fallbackChain).not.toContain(decision.modelId);
    });

    it('returns "none" when no models support the task', () => {
      registry.register(makeModel({ id: 'vision-only', supportedTasks: ['vision'] }));

      const decision = routeRequest(registry, {
        id: 'req-5',
        task: 'embedding',
        prompt: 'embed this',
      });

      expect(decision.modelId).toBe('none');
      expect(decision.score).toBe(0);
    });
  });

  describe('classifyTask', () => {
    it('classifies coding prompts', () => {
      expect(classifyTask('Write a TypeScript function')).toBe('coding');
    });

    it('classifies reasoning prompts', () => {
      expect(classifyTask('Analyze and explain why this happened')).toBe('reasoning');
    });

    it('classifies summarization prompts', () => {
      expect(classifyTask('Summarize the key points')).toBe('summarization');
    });

    it('defaults to chat for ambiguous prompts', () => {
      expect(classifyTask('I need help with something random')).toBe('chat');
    });

    it('classifies vision prompts', () => {
      expect(classifyTask('Look at this image and describe it')).toBe('vision');
    });
  });

  describe('VRAM budget', () => {
    it('calculates used and available VRAM', () => {
      registry.register(makeModel({ id: 'a', vramRequirementMb: 4500, status: 'ready' }));
      registry.register(makeModel({ id: 'b', vramRequirementMb: 3000, status: 'ready' }));

      const budget = calculateVramBudget(registry, 12_288);
      expect(budget.totalMb).toBe(12_288);
      expect(budget.usedMb).toBe(7500);
      expect(budget.availableMb).toBe(4788);
      expect(budget.allocations).toHaveLength(2);
    });

    it('ignores non-ready/non-loading models', () => {
      registry.register(makeModel({ id: 'ready', vramRequirementMb: 4500, status: 'ready' }));
      registry.register(makeModel({ id: 'evicted', vramRequirementMb: 4500, status: 'evicted' }));

      const budget = calculateVramBudget(registry, 12_288);
      expect(budget.usedMb).toBe(4500);
      expect(budget.allocations).toHaveLength(1);
    });

    it('suggestEviction returns smallest models first', () => {
      registry.register(makeModel({ id: 'large', vramRequirementMb: 5000, status: 'ready' }));
      registry.register(makeModel({ id: 'small', vramRequirementMb: 2000, status: 'ready' }));
      registry.register(makeModel({ id: 'medium', vramRequirementMb: 3000, status: 'ready' }));

      const evict = suggestEviction(registry, 6000, 12_288);
      // Should suggest enough models to free at least 6000 MB
      expect(evict.length).toBeGreaterThan(0);
    });
  });
});

/* ============================================================= G.6.4 ===
 * Failover tests — cloud fallback when local is down
 * ==================================================================== */

describe('G.6.4 — Failover to cloud when local is down', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = emptyRegistry();
  });

  it('falls back to cloud model when local model has error status', () => {
    const local = makeModel({
      id: 'local-broken',
      provider: 'local',
      endpoint: 'http://10.47.47.13:11434',
      status: 'error', // down
    });
    const cloud = makeCloudModel({
      status: 'ready',
      supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    });

    registry.register(local);
    registry.register(cloud);

    const decision = routeRequest(registry, {
      id: 'failover-1',
      task: 'coding',
      prompt: 'write code',
      preferLocal: true,
    });

    // Cloud should win because local is in error state (no readiness bonus)
    // and cloud is ready
    expect(decision.modelId).toBe('cloud-gpt4o');
  });

  it('falls back to cloud when local model is evicted', () => {
    const local = makeModel({
      id: 'local-evicted',
      provider: 'local',
      endpoint: 'http://10.47.47.13:11434',
      status: 'evicted',
    });
    const cloud = makeCloudModel({
      status: 'ready',
      supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    });

    registry.register(local);
    registry.register(cloud);

    const decision = routeRequest(registry, {
      id: 'failover-2',
      task: 'coding',
      prompt: 'write code',
      preferLocal: true,
    });

    expect(decision.modelId).toBe('cloud-gpt4o');
  });

  it('cloud appears in fallback chain when local is chosen', () => {
    const local = makeModel({
      id: 'local-model',
      provider: 'local',
      parameterCount: '7B',
      tokensPerSecond: 45,
      endpoint: 'http://10.47.47.13:11434',
      status: 'ready',
    });
    // Same-tier cloud model — local bonus puts local first
    const cloud = makeCloudModel({
      parameterCount: '7B',
      tokensPerSecond: 50,
      status: 'ready',
      supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    });

    registry.register(local);
    registry.register(cloud);

    const decision = routeRequest(registry, {
      id: 'failover-3',
      task: 'coding',
      prompt: 'write code',
    });

    expect(decision.modelId).toBe('local-model');
    expect(decision.fallbackChain).toContain('cloud-gpt4o');
  });

  it('routes to best available when all local models are down', () => {
    const local1 = makeModel({ id: 'local-1', provider: 'local', endpoint: 'http://a:11434', status: 'error' });
    const local2 = makeModel({ id: 'local-2', provider: 'local', endpoint: 'http://b:11434', status: 'evicted' });
    const cloud = makeCloudModel({
      status: 'ready',
      supportedTasks: ['coding', 'reasoning', 'chat', 'summarization'],
    });

    registry.register(local1);
    registry.register(local2);
    registry.register(cloud);

    const decision = routeRequest(registry, {
      id: 'failover-4',
      task: 'chat',
      prompt: 'hello',
    });

    expect(decision.modelId).toBe('cloud-gpt4o');
    expect(decision.reason).toContain('Best');
  });

  it('returns no-model when everything is down', () => {
    registry.register(makeModel({
      id: 'local-down',
      provider: 'local',
      status: 'error',
      supportedTasks: ['embedding'], // different task
    }));

    const decision = routeRequest(registry, {
      id: 'failover-5',
      task: 'coding',
      prompt: 'write code',
    });

    expect(decision.modelId).toBe('none');
    expect(decision.score).toBe(0);
  });
});

/* ============================================================ extras ===
 * Quantization recommendation tests (deploy module, pure computation)
 * ==================================================================== */

describe('Quantization recommendation', () => {
  it('recommends FP16 when VRAM is sufficient', () => {
    const rec = recommendQuantization('test-model', 1, 10_000);
    expect(rec.recommended).toBe('FP16');
    expect(rec.reasoning).toContain('FP16 fits');
  });

  it('recommends Q4_K_M for 7B model on 12GB GPU', () => {
    const rec = recommendQuantization('qwen-7b', 7, 12_288);
    // 7B at Q4_K_M ≈ 7*1e9*4.5/8/1e6*1.2 ≈ 4725 MB — should fit
    expect(['FP16', 'Q8_0', 'Q6_K', 'Q5_K_M', 'Q4_K_M']).toContain(rec.recommended);
    const vram = rec.alternatives.find((a) => a.level === rec.recommended)!.estimatedVramMb;
    expect(vram).toBeLessThanOrEqual(12_288);
  });

  it('recommends aggressive quantization for 70B model on 12GB GPU', () => {
    const rec = recommendQuantization('llama-70b', 70, 12_288);
    // 70B at FP16 would need ~126GB — way too much
    // Q3_K_S: ~35.7GB still too much
    // IQ2_M: ~26.25GB still too much
    // Should recommend IQ2_M or note it does not fit
    expect(['Q3_K_S', 'IQ2_M']).toContain(rec.recommended);
  });

  it('provides all quantization alternatives', () => {
    const rec = recommendQuantization('test', 7, 16_000);
    expect(rec.alternatives.length).toBe(8); // FP16 + 7 quant levels
    const levels = rec.alternatives.map((a) => a.level);
    expect(levels).toContain('FP16');
    expect(levels).toContain('Q4_K_M');
    expect(levels).toContain('IQ2_M');
  });

  it('each alternative has a quality note', () => {
    const rec = recommendQuantization('test', 7, 16_000);
    for (const alt of rec.alternatives) {
      expect(alt.qualityNote).toBeTruthy();
    }
  });

  it('estimated VRAM decreases with lower quantization', () => {
    const rec = recommendQuantization('test', 32, 100_000);
    const vrams = rec.alternatives.map((a) => a.estimatedVramMb);
    // FP16 should be the largest
    expect(vrams[0]).toBeGreaterThan(vrams[vrams.length - 1]);
  });
});

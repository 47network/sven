// ---------------------------------------------------------------------------
// Epic B — Evolution Engine Unit Tests
// ---------------------------------------------------------------------------

import {
  ucb1Select,
  greedySelect,
  randomSelect,
  mapElitesSelect,
  selectParent,
  evaluate,
  evolutionStep,
  startEvolution,
  stopEvolution,
  getRun,
  listRuns,
  getBestNode,
  injectKnowledge,
  runEvolution,
  mergeConfig,
  listTemplates,
  getTemplate,
  getEvolutionStats,
  resetIdCounter,
  type EvolutionNode,
  type EvolutionLLMProvider,
  type Evaluator,
  type ExperimentTemplate,
} from '../evolution-engine';

/* -------- helpers -------- */

function makeNode(overrides: Partial<EvolutionNode> = {}): EvolutionNode {
  return {
    id: `node_${Math.random().toString(36).slice(2, 8)}`,
    runId: 'run_test',
    parentId: null,
    generation: 0,
    code: 'return 42;',
    score: 0.5,
    metrics: {},
    analysis: '',
    visits: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockProvider(response = 'mock response'): EvolutionLLMProvider {
  return {
    complete: jest.fn().mockResolvedValue({ text: response }),
  };
}

function makeMockEvaluator(score = 0.7, metrics: Record<string, number> = {}): Evaluator {
  return jest.fn().mockResolvedValue({ score, metrics });
}

const testExperiment: ExperimentTemplate = {
  domain: 'custom',
  name: 'Test Experiment',
  description: 'Test evolution for unit tests',
  evaluatorCode: 'test',
  baselineCode: 'function baseline() { return 0; }',
  cognitionSeeds: ['Seed knowledge for testing'],
  config: { maxGenerations: 3, populationSize: 2 },
};

beforeEach(() => {
  resetIdCounter();
});

// ===== B.1.5 — Sampling Algorithms =====

describe('UCB1 selection', () => {
  it('selects unvisited nodes first (infinite exploration)', () => {
    const visited = makeNode({ id: 'a', score: 0.9, visits: 5 });
    const unvisited = makeNode({ id: 'b', score: 0.1, visits: 0 });
    const result = ucb1Select([visited, unvisited], 10, 1.41);
    expect(result.id).toBe('b');
  });

  it('selects high-score nodes when all have been visited equally', () => {
    const high = makeNode({ id: 'a', score: 0.9, visits: 5 });
    const low = makeNode({ id: 'b', score: 0.2, visits: 5 });
    const result = ucb1Select([high, low], 10, 1.41);
    expect(result.id).toBe('a');
  });

  it('balances exploration/exploitation with C parameter', () => {
    const exploited = makeNode({ id: 'a', score: 0.8, visits: 50 });
    const explored = makeNode({ id: 'b', score: 0.6, visits: 2 });
    // With high exploration weight, low-visit node should win
    const result = ucb1Select([exploited, explored], 100, 5.0);
    expect(result.id).toBe('b');
  });

  it('returns single node when only one available', () => {
    const single = makeNode({ id: 'only' });
    expect(ucb1Select([single], 10, 1.41).id).toBe('only');
  });

  it('throws on empty array', () => {
    expect(() => ucb1Select([], 10, 1.41)).toThrow('No nodes to select from');
  });
});

describe('Greedy selection', () => {
  it('picks highest scoring node', () => {
    const nodes = [
      makeNode({ id: 'low', score: 0.2 }),
      makeNode({ id: 'high', score: 0.95 }),
      makeNode({ id: 'mid', score: 0.5 }),
    ];
    expect(greedySelect(nodes).id).toBe('high');
  });

  it('throws on empty array', () => {
    expect(() => greedySelect([])).toThrow('No nodes to select from');
  });
});

describe('Random selection', () => {
  it('returns a node from the array', () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' }), makeNode({ id: 'c' })];
    const result = randomSelect(nodes);
    expect(['a', 'b', 'c']).toContain(result.id);
  });

  it('throws on empty array', () => {
    expect(() => randomSelect([])).toThrow('No nodes to select from');
  });
});

describe('MAP-Elites selection', () => {
  it('selects from under-represented cells', () => {
    // Create a cluster of nodes in one score range and one outlier
    const nodes = [
      makeNode({ id: 'crowd1', score: 0.8 }),
      makeNode({ id: 'crowd2', score: 0.81 }),
      makeNode({ id: 'crowd3', score: 0.82 }),
      makeNode({ id: 'lone', score: 0.2 }),
    ];
    const result = mapElitesSelect(nodes, 5);
    // The lone node in the low-score cell should be selected (least-filled cell)
    expect(result.id).toBe('lone');
  });

  it('returns single node', () => {
    const single = makeNode({ id: 'only' });
    expect(mapElitesSelect([single]).id).toBe('only');
  });
});

describe('selectParent dispatcher', () => {
  it('dispatches to ucb1', () => {
    const node = makeNode({ visits: 0 });
    expect(selectParent([node], 'ucb1', 10, 1.41)).toBe(node);
  });

  it('dispatches to greedy', () => {
    const node = makeNode({ score: 0.9 });
    expect(selectParent([node], 'greedy', 10, 1.41)).toBe(node);
  });

  it('dispatches to random', () => {
    const node = makeNode();
    expect(selectParent([node], 'random', 10, 1.41)).toBe(node);
  });

  it('dispatches to map_elites', () => {
    const node = makeNode();
    expect(selectParent([node], 'map_elites', 10, 1.41)).toBe(node);
  });
});

// ===== B.1.6 — Evaluator =====

describe('evaluate', () => {
  it('runs evaluator and clamps score to [0,1]', async () => {
    const evaluator: Evaluator = jest.fn().mockResolvedValue({ score: 1.5, metrics: { acc: 0.9 } });
    const result = await evaluate(evaluator, 'code', {}, 5000);
    expect(result.score).toBe(1);
    expect(result.metrics.acc).toBe(0.9);
  });

  it('clamps negative scores to 0', async () => {
    const evaluator: Evaluator = jest.fn().mockResolvedValue({ score: -0.5, metrics: {} });
    const result = await evaluate(evaluator, 'code', {}, 5000);
    expect(result.score).toBe(0);
  });

  it('returns 0 score on evaluator error', async () => {
    const evaluator: Evaluator = jest.fn().mockRejectedValue(new Error('boom'));
    const result = await evaluate(evaluator, 'code', {}, 5000);
    expect(result.score).toBe(0);
    expect(result.error).toContain('boom');
  });

  it('times out long evaluations', async () => {
    const slow: Evaluator = () => new Promise((resolve) => setTimeout(() => resolve({ score: 1, metrics: {} }), 10_000));
    const result = await evaluate(slow, 'code', {}, 50);
    expect(result.score).toBe(0);
    expect(result.error).toContain('timeout');
  });
});

// ===== B.1.2/B.1.7 — Evolution Step & Loop =====

describe('evolutionStep', () => {
  it('runs one step: research → engineer → evaluate → analyze', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 3, populationSize: 1 },
    });

    const provider = makeMockProvider('```\nfunction improved() { return 1; }\n```');
    const evaluator = makeMockEvaluator(0.75, { accuracy: 0.8 });

    const result = await evolutionStep(run, provider, evaluator);

    expect(result.score).toBe(0.75);
    expect(result.generation).toBe(0);
    expect(result.nodeId).toBeDefined();
    expect(run.nodes.length).toBe(1);
    expect(run.totalEvaluations).toBe(1);
    expect(run.bestScore).toBe(0.75);
  });

  it('selects parent in subsequent steps', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 3, populationSize: 1 },
    });

    const provider = makeMockProvider('improved code');
    const evaluator = makeMockEvaluator(0.6);

    // First step (no parent)
    const step1 = await evolutionStep(run, provider, evaluator);
    expect(step1.parentId).toBeNull();

    // Second step (has parent)
    const step2 = await evolutionStep(run, provider, evaluator);
    expect(step2.parentId).toBe(step1.nodeId);
  });
});

describe('runEvolution', () => {
  it('runs full loop for N generations', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 2, populationSize: 1, parallelWorkers: 1 },
    });

    const provider = makeMockProvider('solution');
    const evaluator = makeMockEvaluator(0.8);
    const steps: number[] = [];

    const result = await runEvolution(run, provider, evaluator, (step) => {
      steps.push(step.generation);
    });

    expect(result.status).toBe('completed');
    expect(result.totalEvaluations).toBe(2);
    expect(result.bestScore).toBe(0.8);
    expect(result.completedAt).toBeDefined();
    expect(steps.length).toBe(2);
  });

  it('handles evaluator failure gracefully', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });

    const provider = makeMockProvider('code');
    const evaluator: Evaluator = jest.fn().mockRejectedValue(new Error('eval failed'));

    const result = await runEvolution(run, provider, evaluator);

    expect(result.status).toBe('completed');
    expect(result.nodes[0].score).toBe(0);
  });

  it('handles provider failure gracefully', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });

    const provider: EvolutionLLMProvider = {
      complete: jest.fn().mockRejectedValue(new Error('LLM down')),
    };
    const evaluator = makeMockEvaluator(0.3);

    const result = await runEvolution(run, provider, evaluator);

    // Should still complete — fallback logic kicks in
    expect(result.status).toBe('completed');
    expect(result.nodes.length).toBe(1);
  });

  it('updates best score when improvement found', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 3, populationSize: 1 },
    });

    let callCount = 0;
    const evaluator: Evaluator = jest.fn().mockImplementation(async () => {
      callCount++;
      return { score: callCount * 0.2, metrics: {} };
    });
    const provider = makeMockProvider('code');

    const result = await runEvolution(run, provider, evaluator);

    expect(result.bestScore).toBeCloseTo(0.6, 5); // 3rd call: 0.6
    expect(result.bestNodeId).toBeDefined();
  });
});

// ===== Start/Stop/Lifecycle =====

describe('startEvolution', () => {
  it('creates a run with seeds', () => {
    const run = startEvolution({
      orgId: 'org1',
      userId: 'user1',
      experiment: testExperiment,
    });

    expect(run.id).toMatch(/^evo_/);
    expect(run.status).toBe('pending');
    expect(run.orgId).toBe('org1');
    expect(run.cognition.length).toBe(1); // 1 seed
    expect(run.cognition[0].source).toBe('seed');
  });

  it('merges config with defaults', () => {
    const run = startEvolution({
      orgId: 'org1',
      experiment: testExperiment,
      config: { maxGenerations: 100 },
    });

    expect(run.config.maxGenerations).toBe(100);
    expect(run.config.populationSize).toBe(2); // From experiment template
    expect(run.config.explorationWeight).toBe(1.41); // From default
  });
});

describe('stopEvolution', () => {
  it('stops a pending run', () => {
    const run = startEvolution({ orgId: 'org1', experiment: testExperiment });
    expect(stopEvolution(run.id)).toBe(true);
    expect(getRun(run.id)!.status).toBe('stopped');
  });

  it('returns false for non-existent run', () => {
    expect(stopEvolution('nonexistent')).toBe(false);
  });

  it('returns false for already completed run', async () => {
    const run = startEvolution({
      orgId: 'org1',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });
    await runEvolution(run, makeMockProvider(), makeMockEvaluator());
    expect(stopEvolution(run.id)).toBe(false);
  });
});

describe('getBestNode', () => {
  it('returns undefined when no best node', () => {
    const run = startEvolution({ orgId: 'org1', experiment: testExperiment });
    expect(getBestNode(run.id)).toBeUndefined();
  });

  it('returns best node after evolution', async () => {
    const run = startEvolution({
      orgId: 'org1',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });
    await runEvolution(run, makeMockProvider(), makeMockEvaluator(0.9));
    const best = getBestNode(run.id);
    expect(best).toBeDefined();
    expect(best!.score).toBe(0.9);
  });
});

describe('injectKnowledge', () => {
  it('adds user knowledge to cognition store', () => {
    const run = startEvolution({ orgId: 'org1', experiment: testExperiment });
    expect(injectKnowledge(run.id, 'Test Insight', 'Use momentum indicators')).toBe(true);
    expect(getRun(run.id)!.cognition.length).toBe(2); // 1 seed + 1 injected
    expect(getRun(run.id)!.cognition[1].source).toBe('user');
    expect(getRun(run.id)!.cognition[1].relevance).toBe(0.9);
  });

  it('returns false for non-existent run', () => {
    expect(injectKnowledge('nonexistent', 'T', 'C')).toBe(false);
  });
});

// ===== Config & Templates (B.2, B.3) =====

describe('mergeConfig', () => {
  it('merges partial config with defaults', () => {
    const config = mergeConfig({ maxGenerations: 100, samplingStrategy: 'greedy' });
    expect(config.maxGenerations).toBe(100);
    expect(config.samplingStrategy).toBe('greedy');
    expect(config.populationSize).toBe(10); // default
    expect(config.explorationWeight).toBe(1.41); // default
  });
});

describe('templates', () => {
  it('lists all non-custom templates', () => {
    const templates = listTemplates();
    expect(templates.length).toBe(4);
    expect(templates.every((t) => t.domain !== 'custom')).toBe(true);
  });

  it('gets template by domain', () => {
    const template = getTemplate('prompt_engineering');
    expect(template.name).toBe('Prompt Engineering Evolution');
    expect(template.cognitionSeeds.length).toBeGreaterThan(0);
    expect(template.baselineCode.length).toBeGreaterThan(0);
  });

  it('has baseline code for all domains', () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.baselineCode.length).toBeGreaterThan(0);
    }
  });
});

describe('listRuns', () => {
  it('lists runs sorted by updated_at desc', () => {
    startEvolution({ orgId: 'org1', experiment: testExperiment });
    startEvolution({ orgId: 'org1', experiment: testExperiment });
    const runs = listRuns(10);
    expect(runs.length).toBeGreaterThanOrEqual(2);
    expect(runs[0].updatedAt >= runs[1].updatedAt).toBe(true);
  });
});

describe('getEvolutionStats', () => {
  it('returns aggregate stats', async () => {
    const run = startEvolution({
      orgId: 'org1',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });
    await runEvolution(run, makeMockProvider(), makeMockEvaluator(0.85));

    const stats = getEvolutionStats();
    expect(stats.totalRuns).toBeGreaterThan(0);
    expect(stats.completedRuns).toBeGreaterThan(0);
    expect(stats.totalEvaluations).toBeGreaterThan(0);
  });
});

// ===== Cognition & Learning Feedback =====

describe('cognition feedback loop', () => {
  it('adds researcher cognition during step', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 1, populationSize: 1 },
    });

    // Provider returns a substantial response so researcher adds cognition
    const provider = makeMockProvider('This is a detailed analysis of the problem space with many insights about the solution approach and key patterns to leverage for improvement. The data shows clear trends.');
    const evaluator = makeMockEvaluator(0.8);

    await evolutionStep(run, provider, evaluator);

    const researcherCog = run.cognition.filter((c) => c.source === 'researcher');
    expect(researcherCog.length).toBeGreaterThan(0);
  });

  it('adds analyzer cognition on improvement', async () => {
    const run = startEvolution({
      orgId: 'test',
      experiment: testExperiment,
      config: { maxGenerations: 2, populationSize: 1 },
    });

    let callNum = 0;
    const evaluator: Evaluator = jest.fn().mockImplementation(async () => {
      callNum++;
      return { score: callNum * 0.3, metrics: {} };
    });
    const provider = makeMockProvider('improved analysis response with significant detail about the improvement');

    await runEvolution(run, provider, evaluator);

    const analyzerCog = run.cognition.filter((c) => c.source === 'analyzer');
    expect(analyzerCog.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ASI-Evolve Integration — Self-Improving Research Loop
// ---------------------------------------------------------------------------
// Port of the ASI-Evolve Learn → Design → Experiment → Analyze loop.
// 3-agent pipeline: Researcher, Engineer, Analyzer.
// Sampling algorithms: UCB1, greedy, random, MAP-Elites.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';
import { JobManager, type MeshJob, type DecompositionConfig } from '@sven/compute-mesh';
import {
  createWorkUnit,
  type WorkUnit,
  type ResourceRequirements,
} from '@sven/compute-mesh';

const logger = createLogger('evolution');

/* ------------------------------------------------------------------ types */

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
export type SamplingStrategy = 'ucb1' | 'greedy' | 'random' | 'map_elites';
export type ExperimentDomain = 'rag_retrieval' | 'model_routing' | 'prompt_engineering' | 'scheduling' | 'custom';

export interface EvolutionConfig {
  maxGenerations: number;
  populationSize: number;
  samplingStrategy: SamplingStrategy;
  explorationWeight: number; // UCB1 C parameter
  eliteCount: number;
  mutationRate: number;
  timeoutMs: number;
  evaluatorTimeoutMs: number;
  parallelWorkers: number;
}

export interface ExperimentTemplate {
  domain: ExperimentDomain;
  name: string;
  description: string;
  evaluatorCode: string;
  baselineCode: string;
  cognitionSeeds: string[];
  config: Partial<EvolutionConfig>;
}

export interface EvolutionNode {
  id: string;
  runId: string;
  parentId: string | null;
  generation: number;
  code: string;
  score: number;
  metrics: Record<string, number>;
  analysis: string;
  visits: number;
  createdAt: string;
}

export interface CognitionEntry {
  id: string;
  runId: string;
  title: string;
  content: string;
  source: 'seed' | 'researcher' | 'analyzer' | 'user';
  relevance: number;
  createdAt: string;
}

export interface EvolutionRun {
  id: string;
  orgId: string;
  userId?: string;
  experiment: ExperimentTemplate;
  config: EvolutionConfig;
  status: RunStatus;
  currentGeneration: number;
  nodes: EvolutionNode[];
  cognition: CognitionEntry[];
  bestNodeId: string | null;
  bestScore: number;
  totalEvaluations: number;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  error?: string;
}

export interface EvolutionStepResult {
  nodeId: string;
  generation: number;
  score: number;
  improvement: number;
  parentId: string | null;
  analysis: string;
}

/** Minimal interface for LLM calls — decoupled for testability */
export interface EvolutionLLMProvider {
  complete(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string }>;
}

/** Evaluator function — scores a candidate solution */
export type Evaluator = (code: string, context: Record<string, unknown>) => Promise<{
  score: number;
  metrics: Record<string, number>;
  error?: string;
}>;

/* ---------------------------------------------------------- defaults */

const DEFAULT_CONFIG: EvolutionConfig = {
  maxGenerations: 50,
  populationSize: 10,
  samplingStrategy: 'ucb1',
  explorationWeight: 1.41, // sqrt(2), standard UCB1
  eliteCount: 3,
  mutationRate: 0.3,
  timeoutMs: 3_600_000, // 1 hour
  evaluatorTimeoutMs: 30_000,
  parallelWorkers: 1,
};

export function mergeConfig(partial: Partial<EvolutionConfig>): EvolutionConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

/* ------------------------------------------------- run store (in-memory) */

const runStore = new Map<string, EvolutionRun>();
const MAX_RUNS = 100;

function storeRun(run: EvolutionRun): void {
  if (runStore.size >= MAX_RUNS) {
    // Evict oldest completed run
    let oldestKey: string | undefined;
    let oldestTime = '';
    for (const [k, v] of runStore) {
      if (v.status === 'completed' || v.status === 'failed' || v.status === 'stopped') {
        if (!oldestTime || v.updatedAt < oldestTime) {
          oldestTime = v.updatedAt;
          oldestKey = k;
        }
      }
    }
    if (oldestKey) runStore.delete(oldestKey);
    else {
      // Evict oldest overall
      const first = runStore.keys().next().value;
      if (first) runStore.delete(first);
    }
  }
  runStore.set(run.id, run);
}

export function getRun(id: string): EvolutionRun | undefined {
  return runStore.get(id);
}

export function listRuns(limit = 20): EvolutionRun[] {
  return [...runStore.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

/* --------------------------------------------------- ID generation */

let idCounter = 0;

function genId(prefix: string): string {
  idCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}_${idCounter}`;
}

/** Exposed for testing */
export function resetIdCounter(): void {
  idCounter = 0;
}

/* ------------------------------------------ Sampling Algorithms (B.1.5) */

/**
 * UCB1 — Upper Confidence Bound for parent selection.
 * Balances exploitation (high score) with exploration (low visit count).
 */
export function ucb1Select(nodes: EvolutionNode[], totalVisits: number, explorationWeight: number): EvolutionNode {
  if (nodes.length === 0) throw new Error('No nodes to select from');
  if (nodes.length === 1) return nodes[0];

  let bestNode = nodes[0];
  let bestUcb = -Infinity;

  for (const node of nodes) {
    const exploitation = node.score;
    const exploration = node.visits > 0
      ? explorationWeight * Math.sqrt(Math.log(totalVisits) / node.visits)
      : Infinity; // Unvisited nodes get infinite exploration bonus
    const ucbValue = exploitation + exploration;

    if (ucbValue > bestUcb) {
      bestUcb = ucbValue;
      bestNode = node;
    }
  }

  return bestNode;
}

/**
 * Greedy — always pick highest scoring node
 */
export function greedySelect(nodes: EvolutionNode[]): EvolutionNode {
  if (nodes.length === 0) throw new Error('No nodes to select from');
  return nodes.reduce((best, n) => n.score > best.score ? n : best, nodes[0]);
}

/**
 * Random — uniform random selection
 */
export function randomSelect(nodes: EvolutionNode[]): EvolutionNode {
  if (nodes.length === 0) throw new Error('No nodes to select from');
  return nodes[Math.floor(Math.random() * nodes.length)];
}

/**
 * MAP-Elites — select from under-represented quality/feature cells.
 * Bins nodes by their primary metric into cells, then picks from the least-filled cell.
 */
export function mapElitesSelect(nodes: EvolutionNode[], cellCount = 10): EvolutionNode {
  if (nodes.length === 0) throw new Error('No nodes to select from');
  if (nodes.length === 1) return nodes[0];

  const minScore = Math.min(...nodes.map((n) => n.score));
  const maxScore = Math.max(...nodes.map((n) => n.score));
  const range = maxScore - minScore || 1;

  // Bin nodes into cells
  const cells: EvolutionNode[][] = Array.from({ length: cellCount }, () => []);
  for (const node of nodes) {
    const cellIdx = Math.min(Math.floor(((node.score - minScore) / range) * cellCount), cellCount - 1);
    cells[cellIdx].push(node);
  }

  // Find least-filled non-empty cell
  let leastFilled = cells.filter((c) => c.length > 0)
    .reduce((a, b) => a.length <= b.length ? a : b);

  // Pick best from that cell
  return leastFilled.reduce((best, n) => n.score > best.score ? n : best, leastFilled[0]);
}

/**
 * Select a parent node based on sampling strategy.
 */
export function selectParent(
  nodes: EvolutionNode[],
  strategy: SamplingStrategy,
  totalVisits: number,
  explorationWeight: number,
): EvolutionNode {
  switch (strategy) {
    case 'ucb1': return ucb1Select(nodes, totalVisits, explorationWeight);
    case 'greedy': return greedySelect(nodes);
    case 'random': return randomSelect(nodes);
    case 'map_elites': return mapElitesSelect(nodes);
    default: return greedySelect(nodes);
  }
}

/* ---------------------------------- 3-Agent Pipeline (B.1.2) */

/**
 * Stage 1: Researcher — scans cognition store for relevant knowledge,
 * formulates a research brief for the Engineer.
 */
async function runResearcher(
  provider: EvolutionLLMProvider,
  run: EvolutionRun,
  parent: EvolutionNode | null,
): Promise<{ brief: string; newCognition: CognitionEntry[] }> {
  const cognitionContext = run.cognition
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 10)
    .map((c) => `[${c.source}] ${c.title}: ${c.content}`)
    .join('\n\n');

  const parentContext = parent
    ? `Current best solution (score: ${parent.score}):\n\`\`\`\n${parent.code}\n\`\`\`\nAnalysis: ${parent.analysis}`
    : 'No existing solution — this is the initial generation.';

  const prompt = `You are the Researcher agent in an evolutionary algorithm pipeline.

Domain: ${run.experiment.domain}
Problem: ${run.experiment.description}
Generation: ${run.currentGeneration + 1}/${run.config.maxGenerations}

${parentContext}

Known insights:\n${cognitionContext || '(none yet)'}

Your task:
1. Analyze patterns from prior solutions and their scores.
2. Identify promising research directions.
3. Suggest specific modifications or entirely new approaches.

Output a concise research brief (max 500 words) for the Engineer agent.`;

  try {
    const result = await provider.complete({
      model: 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      maxTokens: 800,
    });

    const newCognition: CognitionEntry[] = [];

    // Extract key insights from research
    if (result.text.length > 100) {
      newCognition.push({
        id: genId('cog'),
        runId: run.id,
        title: `Research brief G${run.currentGeneration + 1}`,
        content: result.text.slice(0, 500),
        source: 'researcher',
        relevance: 0.7,
        createdAt: new Date().toISOString(),
      });
    }

    return { brief: result.text, newCognition };
  } catch (err) {
    logger.warn('Researcher failed, using fallback brief', { runId: run.id, err: String(err) });
    return {
      brief: parent
        ? `Mutate the current solution. Try a different approach to improve the score from ${parent.score}.`
        : `Generate an initial solution for: ${run.experiment.description}`,
      newCognition: [],
    };
  }
}

/**
 * Stage 2: Engineer — generates a candidate solution based on
 * the Researcher's brief and parent code.
 */
async function runEngineer(
  provider: EvolutionLLMProvider,
  run: EvolutionRun,
  parent: EvolutionNode | null,
  researchBrief: string,
): Promise<string> {
  const baselineContext = parent
    ? `Parent solution (score: ${parent.score}):\n\`\`\`\n${parent.code}\n\`\`\``
    : `Baseline:\n\`\`\`\n${run.experiment.baselineCode}\n\`\`\``;

  const prompt = `You are the Engineer agent in an evolutionary algorithm pipeline.

Domain: ${run.experiment.domain}
Problem: ${run.experiment.description}

${baselineContext}

Research Brief:
${researchBrief}

Generate an improved solution. Output ONLY the code/configuration, no explanations.
The solution must be self-contained and directly executable by the evaluator.`;

  try {
    const result = await provider.complete({
      model: 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7 + (run.config.mutationRate * 0.5),
      maxTokens: 2000,
    });

    // Extract code from markdown fences if present
    const codeMatch = result.text.match(/```[\w]*\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : result.text.trim();
  } catch (err) {
    logger.warn('Engineer failed, using parent/baseline', { runId: run.id, err: String(err) });
    return parent ? parent.code : run.experiment.baselineCode;
  }
}

/**
 * Stage 3: Analyzer — evaluates results and extracts learnings
 * to feed back into the cognition store.
 */
async function runAnalyzer(
  provider: EvolutionLLMProvider,
  run: EvolutionRun,
  node: EvolutionNode,
  parent: EvolutionNode | null,
): Promise<{ analysis: string; cognition: CognitionEntry[] }> {
  const improvement = parent ? node.score - parent.score : node.score;
  const metricsStr = Object.entries(node.metrics)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const prompt = `You are the Analyzer agent in an evolutionary algorithm pipeline.

Domain: ${run.experiment.domain}
Generation: ${run.currentGeneration + 1}

Candidate solution:\n\`\`\`\n${node.code.slice(0, 1500)}\n\`\`\`

Score: ${node.score} (${improvement >= 0 ? '+' : ''}${improvement.toFixed(4)} vs parent)
Metrics: ${metricsStr || 'none'}

${parent ? `Parent score: ${parent.score}\nParent code:\n\`\`\`\n${parent.code.slice(0, 500)}\n\`\`\`` : 'This is the initial generation.'}

Analyze:
1. Why did this candidate score ${improvement >= 0 ? 'better' : 'worse'} than its parent?
2. What specific code patterns contributed to the score?
3. What should the next generation try differently?

Be concise (max 300 words).`;

  try {
    const result = await provider.complete({
      model: 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 500,
    });

    const cognition: CognitionEntry[] = [];

    // Significant improvements get stored as cognition
    if (improvement > 0) {
      cognition.push({
        id: genId('cog'),
        runId: run.id,
        title: `Insight G${run.currentGeneration + 1}: +${improvement.toFixed(4)}`,
        content: result.text.slice(0, 400),
        source: 'analyzer',
        relevance: Math.min(0.5 + improvement, 1.0),
        createdAt: new Date().toISOString(),
      });
    }

    return { analysis: result.text, cognition };
  } catch (err) {
    logger.warn('Analyzer failed, using default analysis', { runId: run.id, err: String(err) });
    return {
      analysis: `Score: ${node.score}, improvement: ${improvement.toFixed(4)}. Analysis unavailable.`,
      cognition: [],
    };
  }
}

/* ------------------------------------------------ Evaluator (B.1.6) */

/**
 * Sandboxed evaluator — runs candidate code through the evaluator function.
 * In production this would use gVisor/Firecracker; here we use Function() with timeout.
 */
export async function evaluate(
  evaluator: Evaluator,
  code: string,
  context: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ score: number; metrics: Record<string, number>; error?: string }> {
  try {
    const result = await Promise.race([
      evaluator(code, context),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Evaluator timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    // Clamp score to [0, 1]
    const clampedScore = Math.max(0, Math.min(1, result.score));

    return { score: clampedScore, metrics: result.metrics, error: result.error };
  } catch (err) {
    logger.warn('Evaluator error', { err: String(err) });
    return { score: 0, metrics: {}, error: String(err) };
  }
}

/* ---------------------------------------- Evolution Loop (B.1.7) */

/**
 * Execute a single evolution step: select parent → research → engineer → evaluate → analyze.
 */
export async function evolutionStep(
  run: EvolutionRun,
  provider: EvolutionLLMProvider,
  evaluator: Evaluator,
): Promise<EvolutionStepResult> {
  // Select parent node
  const livingNodes = run.nodes.filter((n) => n.score >= 0);
  const parent = livingNodes.length > 0
    ? selectParent(livingNodes, run.config.samplingStrategy, run.totalEvaluations, run.config.explorationWeight)
    : null;

  if (parent) parent.visits++;

  // Stage 1: Research
  const { brief, newCognition: researchCognition } = await runResearcher(provider, run, parent);
  run.cognition.push(...researchCognition);

  // Stage 2: Engineer
  const candidateCode = await runEngineer(provider, run, parent, brief);

  // Stage 3: Evaluate
  const evalResult = await evaluate(evaluator, candidateCode, {
    generation: run.currentGeneration,
    domain: run.experiment.domain,
  }, run.config.evaluatorTimeoutMs);

  // Create new node
  const node: EvolutionNode = {
    id: genId('node'),
    runId: run.id,
    parentId: parent?.id ?? null,
    generation: run.currentGeneration,
    code: candidateCode,
    score: evalResult.score,
    metrics: evalResult.metrics,
    analysis: '',
    visits: 0,
    createdAt: new Date().toISOString(),
  };

  // Stage 4: Analyze
  const { analysis, cognition: analyzerCognition } = await runAnalyzer(provider, run, node, parent);
  node.analysis = analysis;
  run.cognition.push(...analyzerCognition);

  // Update run state
  run.nodes.push(node);
  run.totalEvaluations++;

  if (node.score > run.bestScore) {
    run.bestScore = node.score;
    run.bestNodeId = node.id;
    logger.info('New best solution', { runId: run.id, generation: run.currentGeneration, score: node.score });
  }

  run.updatedAt = new Date().toISOString();

  const improvement = parent ? node.score - parent.score : node.score;

  logger.info('Evolution step complete', {
    runId: run.id,
    generation: run.currentGeneration,
    nodeId: node.id,
    score: node.score,
    improvement,
  });

  return {
    nodeId: node.id,
    generation: run.currentGeneration,
    score: node.score,
    improvement,
    parentId: parent?.id ?? null,
    analysis: node.analysis,
  };
}

/**
 * Run the full evolution loop for N generations.
 */
export async function runEvolution(
  run: EvolutionRun,
  provider: EvolutionLLMProvider,
  evaluator: Evaluator,
  onStep?: (result: EvolutionStepResult) => void,
): Promise<EvolutionRun> {
  run.status = 'running';
  run.startedAt = new Date().toISOString();
  run.updatedAt = run.startedAt;
  storeRun(run);

  logger.info('Evolution started', { runId: run.id, domain: run.experiment.domain, maxGenerations: run.config.maxGenerations });

  const startTime = Date.now();

  try {
    for (let gen = 0; gen < run.config.maxGenerations; gen++) {
      // Check timeout
      if (Date.now() - startTime > run.config.timeoutMs) {
        logger.warn('Evolution timeout', { runId: run.id, generation: gen });
        run.status = 'stopped';
        run.error = 'Timeout reached';
        break;
      }

      // Check if stopped externally
      const current = runStore.get(run.id);
      if (current && current.status === 'stopped') {
        logger.info('Evolution stopped by user', { runId: run.id, generation: gen });
        break;
      }

      run.currentGeneration = gen;

      // Run population-sized steps per generation
      const stepCount = Math.min(run.config.populationSize, run.config.parallelWorkers > 1 ? run.config.parallelWorkers : run.config.populationSize);

      if (run.config.parallelWorkers > 1) {
        // Parallel execution via compute-mesh (B.1.8)
        const results = await runParallelEvolutionSteps(run, provider, evaluator, stepCount);
        for (const result of results) {
          if (onStep) onStep(result);
        }
      } else {
        // Sequential execution (original path)
        for (let s = 0; s < stepCount; s++) {
          const result = await evolutionStep(run, provider, evaluator);
          if (onStep) onStep(result);
        }
      }

      // Prune: keep only elite + diverse nodes per generation
      pruneGeneration(run);

      storeRun(run);
    }

    if (run.status === 'running') {
      run.status = 'completed';
    }
  } catch (err) {
    run.status = 'failed';
    run.error = String(err);
    logger.error('Evolution failed', { runId: run.id, err: String(err) });
  }

  run.completedAt = new Date().toISOString();
  run.updatedAt = run.completedAt;
  storeRun(run);

  logger.info('Evolution finished', {
    runId: run.id,
    status: run.status,
    generations: run.currentGeneration + 1,
    bestScore: run.bestScore,
    totalEvaluations: run.totalEvaluations,
  });

  return run;
}

/* ----------------------------------------------- Parallel Workers (B.1.8) */

/**
 * Shared JobManager instance for evolution compute-mesh integration.
 * Each parallel evolution step is a work unit within a mesh job.
 */
let meshJobManager: JobManager | null = null;

export function getEvolutionJobManager(): JobManager {
  if (!meshJobManager) {
    meshJobManager = new JobManager();
  }
  return meshJobManager;
}

export function setEvolutionJobManager(jm: JobManager): void {
  meshJobManager = jm;
}

/**
 * Schedule a batch of evolution steps as parallel work units via compute-mesh.
 * Each work unit runs an independent evolution step (parent sampling → LLM → evaluate).
 * Results are collected via Promise.allSettled for fault tolerance.
 */
async function runParallelEvolutionSteps(
  run: EvolutionRun,
  provider: EvolutionLLMProvider,
  evaluator: Evaluator,
  workerCount: number,
): Promise<EvolutionStepResult[]> {
  const jm = getEvolutionJobManager();
  const results: EvolutionStepResult[] = [];

  // Create a mesh job for this generation
  const job = jm.createJob(
    `evolution-${run.id}-gen-${run.currentGeneration}`,
    `Parallel evolution steps for run ${run.id}, generation ${run.currentGeneration}`,
    {
      strategy: 'scatter_gather',
      payloads: Array.from({ length: workerCount }, (_, i) => ({
        runId: run.id,
        generation: run.currentGeneration,
        workerIndex: i,
      })),
      resourceReqs: {
        minCpuCores: 1,
        minRamMb: 512,
        requiresGpu: false,
        minVramMb: 0,
      },
      priority: 7, // evolution is high-priority compute
    },
  );

  job.status = 'running';
  job.startedAt = new Date().toISOString();

  logger.info('Parallel evolution batch started', {
    runId: run.id,
    generation: run.currentGeneration,
    workerCount,
    jobId: job.id,
  });

  // Execute steps in parallel using Promise.allSettled for fault tolerance
  const stepPromises = job.workUnits.map(async (unit) => {
    const start = Date.now();
    unit.status = 'running';
    unit.assignedAt = new Date().toISOString();

    try {
      const stepResult = await evolutionStep(run, provider, evaluator);
      const computeMs = Date.now() - start;
      jm.completeUnit(job.id, unit.id, { stepResult }, computeMs);
      return stepResult;
    } catch (err) {
      jm.failUnit(job.id, unit.id, String(err));
      logger.warn('Parallel evolution worker failed', {
        runId: run.id,
        unitId: unit.id,
        error: String(err),
      });
      return null;
    }
  });

  const settled = await Promise.allSettled(stepPromises);

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value !== null) {
      results.push(outcome.value);
    }
  }

  logger.info('Parallel evolution batch completed', {
    runId: run.id,
    generation: run.currentGeneration,
    total: workerCount,
    succeeded: results.length,
    failed: workerCount - results.length,
    jobId: job.id,
  });

  return results;
}

/**
 * Get active compute-mesh jobs associated with evolution runs.
 */
export function listEvolutionMeshJobs(): MeshJob[] {
  const jm = getEvolutionJobManager();
  return jm.list().filter((j) => j.name.startsWith('evolution-'));
}

/**
 * Get progress for a specific evolution mesh job.
 */
export function getEvolutionMeshProgress(runId: string, generation: number): ReturnType<JobManager['progress']> {
  const jm = getEvolutionJobManager();
  const job = jm.list().find((j) => j.name === `evolution-${runId}-gen-${generation}`);
  return job ? jm.progress(job.id) : null;
}

/* ----------------------------------------------- Pruning */

function pruneGeneration(run: EvolutionRun): void {
  const gen = run.currentGeneration;
  const generationNodes = run.nodes.filter((n) => n.generation === gen);

  if (generationNodes.length <= run.config.eliteCount) return;

  // Sort by score descending, keep elites
  generationNodes.sort((a, b) => b.score - a.score);
  const elites = new Set(generationNodes.slice(0, run.config.eliteCount).map((n) => n.id));

  // Mark non-elite nodes from this generation (don't remove — keep history, but lower visits)
  for (const node of generationNodes) {
    if (!elites.has(node.id)) {
      node.visits = Math.max(0, node.visits - 1);
    }
  }
}

/* ------------------------------------------ Start/Stop API */

export function startEvolution(params: {
  orgId: string;
  userId?: string;
  experiment: ExperimentTemplate;
  config?: Partial<EvolutionConfig>;
}): EvolutionRun {
  const config = mergeConfig({ ...params.experiment.config, ...params.config });
  const now = new Date().toISOString();

  const run: EvolutionRun = {
    id: genId('evo'),
    orgId: params.orgId,
    userId: params.userId,
    experiment: params.experiment,
    config,
    status: 'pending',
    currentGeneration: 0,
    nodes: [],
    cognition: [],
    bestNodeId: null,
    bestScore: -Infinity,
    totalEvaluations: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };

  // Seed cognition from experiment
  for (const seed of params.experiment.cognitionSeeds) {
    run.cognition.push({
      id: genId('cog'),
      runId: run.id,
      title: 'Seed knowledge',
      content: seed,
      source: 'seed',
      relevance: 0.8,
      createdAt: now,
    });
  }

  storeRun(run);
  logger.info('Evolution run created', { runId: run.id, domain: params.experiment.domain });
  return run;
}

export function stopEvolution(runId: string): boolean {
  const run = runStore.get(runId);
  if (!run) return false;
  if (run.status !== 'running' && run.status !== 'pending') return false;

  run.status = 'stopped';
  run.updatedAt = new Date().toISOString();
  storeRun(run);
  logger.info('Evolution run stopped', { runId });
  return true;
}

export function getBestNode(runId: string): EvolutionNode | undefined {
  const run = runStore.get(runId);
  if (!run || !run.bestNodeId) return undefined;
  return run.nodes.find((n) => n.id === run.bestNodeId);
}

export function injectKnowledge(runId: string, title: string, content: string): boolean {
  const run = runStore.get(runId);
  if (!run) return false;

  run.cognition.push({
    id: genId('cog'),
    runId,
    title,
    content,
    source: 'user',
    relevance: 0.9, // User-provided knowledge gets high relevance
    createdAt: new Date().toISOString(),
  });

  run.updatedAt = new Date().toISOString();
  storeRun(run);
  logger.info('Knowledge injected', { runId, title });
  return true;
}

/* --------------------------------- Pre-Built Experiment Templates (B.3) */

export const EXPERIMENT_TEMPLATES: Record<ExperimentDomain, ExperimentTemplate> = {
  rag_retrieval: {
    domain: 'rag_retrieval',
    name: 'RAG Retrieval Evolution',
    description: 'Evolve scoring and fusion weights for RAG retrieval. Evaluator measures retrieval accuracy, MRR, and NDCG on a test set.',
    evaluatorCode: 'evaluate(weights, testQueries, groundTruth) → { accuracy, mrr, ndcg }',
    baselineCode: `const weights = {
  bm25: 0.4,
  vector: 0.4,
  mmr_lambda: 0.5,
  recency_boost: 0.1,
  title_boost: 1.2,
  chunk_size: 512,
  top_k: 10,
};`,
    cognitionSeeds: [
      'BM25 excels at exact keyword matching.',
      'Vector similarity captures semantic meaning.',
      'MMR lambda controls diversity vs relevance trade-off.',
      'Smaller chunks improve precision, larger chunks improve recall.',
    ],
    config: { maxGenerations: 40, populationSize: 12, samplingStrategy: 'map_elites' },
  },

  model_routing: {
    domain: 'model_routing',
    name: 'Model Routing Evolution',
    description: 'Evolve routing heuristics for model selection. Evaluator measures quality (judge score), latency (p95), and cost per query.',
    evaluatorCode: 'evaluate(router, testQueries) → { quality, latency_p95, cost_per_query }',
    baselineCode: `function route(query, models) {
  const complexity = query.length > 500 ? 'high' : query.length > 100 ? 'medium' : 'low';
  if (complexity === 'high') return models.find(m => m.size === 'large');
  if (complexity === 'medium') return models.find(m => m.size === 'medium');
  return models.find(m => m.size === 'small') || models[0];
}`,
    cognitionSeeds: [
      'Query complexity is not well-captured by length alone.',
      'Task type (coding, reasoning, chat) affects optimal model choice.',
      'Local models have zero marginal cost but higher latency.',
      'Cloud models have better quality for complex tasks.',
    ],
    config: { maxGenerations: 25, populationSize: 6, samplingStrategy: 'ucb1' },
  },

  prompt_engineering: {
    domain: 'prompt_engineering',
    name: 'Prompt Engineering Evolution',
    description: 'Evolve system prompts for task completion. Evaluator measures task accuracy, format compliance, and response quality.',
    evaluatorCode: 'evaluate(prompt, testCases) → { accuracy, format_compliance, quality }',
    baselineCode: `You are a helpful AI assistant. Answer the user's question accurately and concisely.`,
    cognitionSeeds: [
      'Chain-of-thought prompting improves reasoning tasks.',
      'Few-shot examples improve format compliance.',
      'Role-playing prompts improve domain-specific tasks.',
      'Structured output instructions reduce parsing errors.',
    ],
    config: { maxGenerations: 20, populationSize: 10, samplingStrategy: 'greedy' },
  },

  scheduling: {
    domain: 'scheduling',
    name: 'Scheduling Evolution',
    description: 'Evolve workflow scheduling policies. Evaluator measures throughput, fairness, and deadline compliance.',
    evaluatorCode: 'evaluate(scheduler, workload) → { throughput, fairness_index, deadline_met_pct }',
    baselineCode: `function schedule(queue, resources) {
  // Simple FIFO with priority boost
  queue.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.submitted - b.submitted;
  });
  return queue.slice(0, resources.available);
}`,
    cognitionSeeds: [
      'Priority queues ensure high-priority tasks run first.',
      'Fair scheduling prevents starvation of low-priority tasks.',
      'Deadline-aware scheduling can preempt non-urgent work.',
      'Batch processing similar tasks improves cache locality.',
    ],
    config: { maxGenerations: 30, populationSize: 8, samplingStrategy: 'map_elites' },
  },

  custom: {
    domain: 'custom',
    name: 'Custom Evolution',
    description: 'User-defined evolution experiment.',
    evaluatorCode: '',
    baselineCode: '',
    cognitionSeeds: [],
    config: {},
  },
};

export function getTemplate(domain: ExperimentDomain): ExperimentTemplate {
  return EXPERIMENT_TEMPLATES[domain];
}

export function listTemplates(): ExperimentTemplate[] {
  return Object.values(EXPERIMENT_TEMPLATES).filter((t) => t.domain !== 'custom');
}

/* ------------------------------------------------ Stats */

export function getEvolutionStats(): {
  totalRuns: number;
  activeRuns: number;
  completedRuns: number;
  totalEvaluations: number;
  avgBestScore: number;
} {
  const runs = [...runStore.values()];
  const active = runs.filter((r) => r.status === 'running' || r.status === 'pending');
  const completed = runs.filter((r) => r.status === 'completed');
  const totalEvaluations = runs.reduce((s, r) => s + r.totalEvaluations, 0);
  const avgBest = completed.length > 0
    ? completed.reduce((s, r) => s + r.bestScore, 0) / completed.length
    : 0;

  return {
    totalRuns: runs.length,
    activeRuns: active.length,
    completedRuns: completed.length,
    totalEvaluations,
    avgBestScore: Math.round(avgBest * 10000) / 10000,
  };
}

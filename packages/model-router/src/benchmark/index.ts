// ---------------------------------------------------------------------------
// Model Benchmarking
// ---------------------------------------------------------------------------
// Benchmark suite for evaluating model performance across tasks. Includes
// ELO ranking, A/B testing, cost tracking, throughput measurement,
// accuracy evaluation, and comparative reporting.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  tasks: BenchmarkTask[];
  createdAt: string;
}

export interface BenchmarkTask {
  id: string;
  prompt: string;
  expectedOutput?: string;
  taskType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxTokens: number;
  evaluationCriteria: EvaluationCriterion[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number;
  type: 'exact_match' | 'contains' | 'semantic_similarity' | 'code_correctness' | 'latency' | 'cost';
  threshold?: number;
}

export interface BenchmarkRun {
  id: string;
  suiteId: string;
  modelId: string;
  modelName: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  results: TaskResult[];
  aggregate: AggregateMetrics | null;
}

export interface TaskResult {
  taskId: string;
  output: string;
  latencyMs: number;
  tokensUsed: number;
  scores: Record<string, number>;  // criterion name → score 0-100
  passed: boolean;
}

export interface AggregateMetrics {
  overallScore: number;           // 0-100
  avgLatencyMs: number;
  p95LatencyMs: number;
  totalTokensUsed: number;
  costEstimateUsd: number;
  passRate: number;               // 0-1
  tokensPerSecond: number;
}

export interface EloRating {
  modelId: string;
  modelName: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  lastUpdated: string;
}

export interface ABTestConfig {
  id: string;
  modelA: string;
  modelB: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  trials: number;
}

export interface ABTestResult {
  configId: string;
  modelAId: string;
  modelBId: string;
  modelAWins: number;
  modelBWins: number;
  draws: number;
  modelAAvgLatencyMs: number;
  modelBAvgLatencyMs: number;
  modelAAvgScore: number;
  modelBAvgScore: number;
  eloDelta: number;
  winner: string | null;
}

/* -------------------------------------------------------- built-in suites */

const CODING_SUITE: BenchmarkSuite = {
  id: 'coding-eval',
  name: 'Coding Evaluation',
  description: 'Evaluates code generation quality across multiple languages.',
  createdAt: new Date().toISOString(),
  tasks: [
    {
      id: 'code-1',
      prompt: 'Write a TypeScript function that implements binary search on a sorted array.',
      taskType: 'coding',
      difficulty: 'easy',
      maxTokens: 512,
      evaluationCriteria: [
        { name: 'correctness', weight: 0.5, type: 'code_correctness' },
        { name: 'latency', weight: 0.3, type: 'latency', threshold: 5000 },
        { name: 'cost', weight: 0.2, type: 'cost', threshold: 0.01 },
      ],
    },
    {
      id: 'code-2',
      prompt: 'Implement a thread-safe LRU cache in Python with O(1) get and put.',
      taskType: 'coding',
      difficulty: 'medium',
      maxTokens: 1024,
      evaluationCriteria: [
        { name: 'correctness', weight: 0.5, type: 'code_correctness' },
        { name: 'latency', weight: 0.3, type: 'latency', threshold: 8000 },
        { name: 'cost', weight: 0.2, type: 'cost', threshold: 0.02 },
      ],
    },
    {
      id: 'code-3',
      prompt: 'Design a rate limiter using the token bucket algorithm in Go with Redis backing.',
      taskType: 'coding',
      difficulty: 'hard',
      maxTokens: 2048,
      evaluationCriteria: [
        { name: 'correctness', weight: 0.6, type: 'code_correctness' },
        { name: 'latency', weight: 0.2, type: 'latency', threshold: 15000 },
        { name: 'cost', weight: 0.2, type: 'cost', threshold: 0.05 },
      ],
    },
  ],
};

const REASONING_SUITE: BenchmarkSuite = {
  id: 'reasoning-eval',
  name: 'Reasoning Evaluation',
  description: 'Evaluates logical reasoning and analytical capabilities.',
  createdAt: new Date().toISOString(),
  tasks: [
    {
      id: 'reason-1',
      prompt: 'A snail climbs 3 feet during the day and slides back 2 feet at night. How many days to reach the top of a 10-foot wall?',
      expectedOutput: '8',
      taskType: 'reasoning',
      difficulty: 'easy',
      maxTokens: 256,
      evaluationCriteria: [
        { name: 'answer', weight: 0.7, type: 'contains' },
        { name: 'latency', weight: 0.3, type: 'latency', threshold: 3000 },
      ],
    },
    {
      id: 'reason-2',
      prompt: 'Compare and contrast microservices and monolithic architectures. List 5 clear advantages of each with justification.',
      taskType: 'reasoning',
      difficulty: 'medium',
      maxTokens: 1024,
      evaluationCriteria: [
        { name: 'quality', weight: 0.7, type: 'semantic_similarity' },
        { name: 'latency', weight: 0.3, type: 'latency', threshold: 10000 },
      ],
    },
  ],
};

/* ---------------------------------------------------- benchmark engine */

export class BenchmarkEngine {
  private suites = new Map<string, BenchmarkSuite>();
  private runs: BenchmarkRun[] = [];
  private eloRatings = new Map<string, EloRating>();
  private abResults: ABTestResult[] = [];

  constructor() {
    this.suites.set(CODING_SUITE.id, CODING_SUITE);
    this.suites.set(REASONING_SUITE.id, REASONING_SUITE);
  }

  /* ----------- suites ----------- */

  addSuite(suite: BenchmarkSuite): void {
    this.suites.set(suite.id, suite);
  }

  getSuite(id: string): BenchmarkSuite | undefined {
    return this.suites.get(id);
  }

  listSuites(): BenchmarkSuite[] {
    return [...this.suites.values()];
  }

  /* ----------- runs ----------- */

  createRun(suiteId: string, modelId: string, modelName: string): BenchmarkRun | null {
    const suite = this.suites.get(suiteId);
    if (!suite) return null;

    const run: BenchmarkRun = {
      id: `run-${Date.now()}-${modelId}`,
      suiteId,
      modelId,
      modelName,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      results: [],
      aggregate: null,
    };

    this.runs.push(run);
    return run;
  }

  recordTaskResult(runId: string, result: TaskResult): void {
    const run = this.runs.find((r) => r.id === runId);
    if (run) run.results.push(result);
  }

  completeRun(runId: string): BenchmarkRun | null {
    const run = this.runs.find((r) => r.id === runId);
    if (!run) return null;

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    run.aggregate = this.computeAggregate(run);

    return run;
  }

  private computeAggregate(run: BenchmarkRun): AggregateMetrics {
    const results = run.results;
    if (results.length === 0) {
      return { overallScore: 0, avgLatencyMs: 0, p95LatencyMs: 0, totalTokensUsed: 0, costEstimateUsd: 0, passRate: 0, tokensPerSecond: 0 };
    }

    const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
    const totalTokens = results.reduce((s, r) => s + r.tokensUsed, 0);
    const totalLatency = latencies.reduce((s, l) => s + l, 0);
    const passed = results.filter((r) => r.passed).length;

    const allScores = results.flatMap((r) => Object.values(r.scores));
    const avgScore = allScores.length > 0 ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0;

    return {
      overallScore: Math.round(avgScore),
      avgLatencyMs: Math.round(totalLatency / results.length),
      p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] ?? 0,
      totalTokensUsed: totalTokens,
      costEstimateUsd: parseFloat((totalTokens * 0.00003).toFixed(4)), // rough cost estimate
      passRate: passed / results.length,
      tokensPerSecond: totalLatency > 0 ? Math.round((totalTokens / totalLatency) * 1000) : 0,
    };
  }

  getRun(runId: string): BenchmarkRun | undefined {
    return this.runs.find((r) => r.id === runId);
  }

  listRuns(modelId?: string): BenchmarkRun[] {
    return modelId ? this.runs.filter((r) => r.modelId === modelId) : [...this.runs];
  }

  /* ----------- ELO rankings ----------- */

  private ensureElo(modelId: string, modelName: string): EloRating {
    if (!this.eloRatings.has(modelId)) {
      this.eloRatings.set(modelId, {
        modelId,
        modelName,
        elo: 1200, // starting ELO
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
    return this.eloRatings.get(modelId)!;
  }

  updateElo(winnerId: string, winnerName: string, loserId: string, loserName: string, isDraw: boolean = false): void {
    const K = 32;
    const a = this.ensureElo(winnerId, winnerName);
    const b = this.ensureElo(loserId, loserName);

    const expectedA = 1 / (1 + Math.pow(10, (b.elo - a.elo) / 400));
    const expectedB = 1 - expectedA;

    const scoreA = isDraw ? 0.5 : 1;
    const scoreB = isDraw ? 0.5 : 0;

    a.elo = Math.round(a.elo + K * (scoreA - expectedA));
    b.elo = Math.round(b.elo + K * (scoreB - expectedB));

    a.matchesPlayed++;
    b.matchesPlayed++;

    if (isDraw) { a.draws++; b.draws++; }
    else { a.wins++; b.losses++; }

    const now = new Date().toISOString();
    a.lastUpdated = now;
    b.lastUpdated = now;
  }

  getLeaderboard(): EloRating[] {
    return [...this.eloRatings.values()].sort((a, b) => b.elo - a.elo);
  }

  /* ----------- A/B testing ----------- */

  recordABResult(result: ABTestResult): void {
    this.abResults.push(result);
  }

  getABResults(modelId?: string): ABTestResult[] {
    if (!modelId) return [...this.abResults];
    return this.abResults.filter((r) => r.modelAId === modelId || r.modelBId === modelId);
  }

  /* ----------- reporting ----------- */

  generateReport(modelId: string): string {
    const runs = this.listRuns(modelId);
    const elo = this.eloRatings.get(modelId);
    const abs = this.getABResults(modelId);

    const lines: string[] = [
      `# Benchmark Report: ${modelId}`,
      '',
      `## ELO Rating: ${elo?.elo ?? 'N/A'}`,
      `Matches: ${elo?.matchesPlayed ?? 0} | W: ${elo?.wins ?? 0} L: ${elo?.losses ?? 0} D: ${elo?.draws ?? 0}`,
      '',
      `## Runs (${runs.length})`,
    ];

    for (const run of runs) {
      const agg = run.aggregate;
      lines.push(
        `- **${run.suiteId}** (${run.status}): score=${agg?.overallScore ?? 'N/A'} ` +
        `avg_lat=${agg?.avgLatencyMs ?? 0}ms pass=${((agg?.passRate ?? 0) * 100).toFixed(0)}%`,
      );
    }

    if (abs.length > 0) {
      lines.push('', `## A/B Tests (${abs.length})`);
      for (const ab of abs) {
        lines.push(`- vs ${ab.modelAId === modelId ? ab.modelBId : ab.modelAId}: winner=${ab.winner ?? 'draw'}`);
      }
    }

    return lines.join('\n');
  }
}

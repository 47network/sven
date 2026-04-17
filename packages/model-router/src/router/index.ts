// ---------------------------------------------------------------------------
// Inference Router
// ---------------------------------------------------------------------------
// Routes inference requests to the optimal model based on task type, latency
// requirements, cost constraints, and model availability. Provides failover,
// load balancing, warm/cold management, and context window splitting.
// ---------------------------------------------------------------------------

import {
  ModelRegistry,
  type ModelEntry,
  type TaskType,
} from '../registry/index.js';

/* ------------------------------------------------------------------ types */

export interface InferenceRequest {
  id: string;
  task: TaskType;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  preferredModel?: string;           // hint: prefer this model if available
  latencyBudgetMs?: number;          // max acceptable latency
  qualityPriority?: 'speed' | 'balanced' | 'quality';
  contextData?: Record<string, unknown>;
}

export interface InferenceResult {
  requestId: string;
  modelId: string;
  modelName: string;
  output: string;
  tokensUsed: { prompt: number; completion: number; total: number };
  latencyMs: number;
  fromFallback: boolean;
  cached: boolean;
}

export interface RoutingDecision {
  modelId: string;
  modelName: string;
  reason: string;
  score: number;
  fallbackChain: string[];
}

export interface RouterConfig {
  defaultQuality: 'speed' | 'balanced' | 'quality';
  maxFallbackAttempts: number;
  enableCaching: boolean;
  cacheTtlMs: number;
  timeoutMs: number;
}

/* -------------------------------------------------------- task classifier */

const TASK_KEYWORDS: Record<TaskType, string[]> = {
  reasoning: ['think', 'analyze', 'reason', 'explain', 'why', 'compare', 'evaluate', 'assess'],
  coding: ['code', 'function', 'implement', 'debug', 'refactor', 'typescript', 'python', 'api', 'sql'],
  vision: ['image', 'photo', 'picture', 'screenshot', 'diagram', 'visual', 'see', 'look at'],
  ocr: ['read', 'extract text', 'ocr', 'scan', 'document', 'receipt', 'pdf', 'handwriting'],
  translation: ['translate', 'translation', 'in french', 'in spanish', 'in german', 'to english'],
  summarization: ['summarize', 'summary', 'tldr', 'brief', 'key points', 'condensed'],
  financial: ['stock', 'price', 'trade', 'market', 'forecast', 'backtest', 'portfolio', 'financial'],
  embedding: ['embed', 'embedding', 'vector', 'similarity', 'semantic search'],
  chat: ['hello', 'hey', 'hi', 'chat', 'tell me', 'how are'],
  image_generation: ['generate image', 'draw', 'create image', 'picture of', 'illustration'],
};

export function classifyTask(input: string): TaskType {
  const lower = input.toLowerCase();
  let bestTask: TaskType = 'chat';
  let bestScore = 0;

  for (const [task, keywords] of Object.entries(TASK_KEYWORDS) as [TaskType, string[]][]) {
    const hits = keywords.filter((k) => lower.includes(k)).length;
    if (hits > bestScore) {
      bestScore = hits;
      bestTask = task;
    }
  }

  return bestTask;
}

/* --------------------------------------------------------- routing engine */

const QUALITY_WEIGHTS: Record<string, { quality: number; speed: number; cost: number }> = {
  speed: { quality: 0.2, speed: 0.6, cost: 0.2 },
  balanced: { quality: 0.4, speed: 0.3, cost: 0.3 },
  quality: { quality: 0.7, speed: 0.15, cost: 0.15 },
};

export function scoreModel(
  model: ModelEntry,
  task: TaskType,
  priority: 'speed' | 'balanced' | 'quality',
  latencyBudgetMs?: number,
): number {
  const weights = QUALITY_WEIGHTS[priority];

  // Quality score: bigger model = higher quality (simplified heuristic)
  const paramB = parseFloat(model.parameterCount.replace('B', '')) || 1;
  const qualityScore = Math.min(1, paramB / 120);

  // Speed score: smaller model + higher tokens/sec = faster
  const tps = model.tokensPerSecond ?? 30;
  const speedScore = Math.min(1, tps / 100);

  // Cost score: smaller VRAM = lower cost
  const costScore = Math.min(1, 1 - model.vramRequirementMb / 80_000);

  // Task affinity bonus
  const taskAffinity = model.supportedTasks.includes(task) ? 0.2 : -0.5;

  // Latency penalty
  let latencyPenalty = 0;
  if (latencyBudgetMs && tps > 0) {
    const estimatedLatencyMs = (500 / tps) * 1000; // rough estimate for 500 tokens
    if (estimatedLatencyMs > latencyBudgetMs) {
      latencyPenalty = 0.3;
    }
  }

  // Status bonus
  const statusBonus = model.status === 'ready' ? 0.15 : 0;

  const raw =
    weights.quality * qualityScore +
    weights.speed * speedScore +
    weights.cost * costScore +
    taskAffinity +
    statusBonus -
    latencyPenalty;

  return Math.max(0, Math.min(1, raw));
}

export function routeRequest(
  registry: ModelRegistry,
  request: InferenceRequest,
): RoutingDecision {
  const task = request.task ?? classifyTask(request.prompt);
  const priority = request.qualityPriority ?? 'balanced';

  // Get candidate models for this task
  let candidates = registry.listByTask(task);

  // If preferred model specified and available, prioritize it
  if (request.preferredModel) {
    const preferred = registry.get(request.preferredModel);
    if (preferred && preferred.status === 'ready') {
      return {
        modelId: preferred.id,
        modelName: preferred.name,
        reason: `Preferred model "${preferred.name}" available and ready`,
        score: 1,
        fallbackChain: candidates
          .filter((m) => m.id !== preferred.id && m.status === 'ready')
          .map((m) => m.id),
      };
    }
  }

  // Score all candidates
  const scored = candidates
    .map((m) => ({
      model: m,
      score: scoreModel(m, task, priority, request.latencyBudgetMs),
    }))
    .sort((a, b) => b.score - a.score);

  // Prefer ready models, but fall back to available
  const readyCandidates = scored.filter((s) => s.model.status === 'ready');
  const winner = readyCandidates[0] ?? scored[0];

  if (!winner) {
    return {
      modelId: 'none',
      modelName: 'No model available',
      reason: `No model found supporting task "${task}"`,
      score: 0,
      fallbackChain: [],
    };
  }

  const fallbacks = scored
    .filter((s) => s.model.id !== winner.model.id)
    .slice(0, 3)
    .map((s) => s.model.id);

  return {
    modelId: winner.model.id,
    modelName: winner.model.name,
    reason: `Best ${priority} match for "${task}" (score: ${winner.score.toFixed(2)})`,
    score: winner.score,
    fallbackChain: fallbacks,
  };
}

/* --------------------------------------------------------- VRAM manager */

export interface VramBudget {
  totalMb: number;
  usedMb: number;
  availableMb: number;
  allocations: { modelId: string; vramMb: number }[];
}

export function calculateVramBudget(
  registry: ModelRegistry,
  totalVramMb: number,
): VramBudget {
  const readyModels = registry.list().filter(
    (m) => m.status === 'ready' || m.status === 'loading',
  );
  const allocations = readyModels.map((m) => ({
    modelId: m.id,
    vramMb: m.vramRequirementMb,
  }));
  const usedMb = allocations.reduce((s, a) => s + a.vramMb, 0);

  return {
    totalMb: totalVramMb,
    usedMb,
    availableMb: Math.max(0, totalVramMb - usedMb),
    allocations,
  };
}

export function suggestEviction(
  registry: ModelRegistry,
  neededVramMb: number,
  totalVramMb: number,
): string[] {
  const budget = calculateVramBudget(registry, totalVramMb);
  if (budget.availableMb >= neededVramMb) return [];

  // Evict least recently health-checked models first
  const evictable = registry
    .list()
    .filter((m) => m.status === 'ready')
    .sort((a, b) => {
      const aTime = a.lastHealthCheck ? new Date(a.lastHealthCheck).getTime() : 0;
      const bTime = b.lastHealthCheck ? new Date(b.lastHealthCheck).getTime() : 0;
      return aTime - bTime; // oldest first
    });

  const toEvict: string[] = [];
  let freed = 0;
  const deficit = neededVramMb - budget.availableMb;

  for (const m of evictable) {
    if (freed >= deficit) break;
    toEvict.push(m.id);
    freed += m.vramRequirementMb;
  }

  return toEvict;
}

/* --------------------------------------------------- context splitter */

export interface ContextChunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

export function splitContext(
  text: string,
  maxContextTokens: number,
  overlapTokens: number = 200,
): ContextChunk[] {
  // Rough token estimate: ~4 chars per token
  const charsPerToken = 4;
  const maxChars = maxContextTokens * charsPerToken;
  const overlapChars = overlapTokens * charsPerToken;

  if (text.length <= maxChars) {
    return [{ index: 0, text, tokenEstimate: Math.ceil(text.length / charsPerToken) }];
  }

  const chunks: ContextChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.slice(start, end);
    chunks.push({
      index: idx++,
      text: chunk,
      tokenEstimate: Math.ceil(chunk.length / charsPerToken),
    });
    start = end - overlapChars;
    if (start >= text.length) break;
  }

  return chunks;
}

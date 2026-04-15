// ---------------------------------------------------------------------------
// LLM Council — Multi-Model Deliberation Engine
// ---------------------------------------------------------------------------
// 3-stage deliberation: First Opinions → Peer Review → Synthesis
// Used by the llm-council skill and the agent-runtime council_mode.
// ---------------------------------------------------------------------------

import { createLogger } from '@sven/shared';

const logger = createLogger('llm-council');

/* ------------------------------------------------------------------ types */

export type CouncilStrategy = 'best_of_n' | 'majority_vote' | 'debate' | 'weighted';

export interface CouncilConfig {
  models: string[];
  chairman: string;
  anonymize: boolean;
  rounds: number;
  strategy: CouncilStrategy;
  timeoutMs: number;
}

export interface CouncilRequest {
  query: string;
  systemPrompt?: string;
  config: CouncilConfig;
  sessionId?: string;
}

export interface ModelOpinion {
  modelName: string;
  response: string;
  tokensUsed: { prompt: number; completion: number };
  latencyMs: number;
  error?: string;
}

export interface PeerReview {
  reviewerModel: string;
  rankings: Array<{
    candidateLabel: string;
    rank: number;
    rationale: string;
    score: number;
  }>;
  tokensUsed: { prompt: number; completion: number };
}

export interface CouncilSession {
  id: string;
  query: string;
  config: CouncilConfig;
  opinions: ModelOpinion[];
  peerReviews: PeerReview[];
  synthesis: string;
  scores: Map<string, number>;
  totalTokens: { prompt: number; completion: number };
  totalCost: number;
  elapsedMs: number;
  createdAt: string;
}

export interface CouncilResult {
  sessionId: string;
  synthesis: string;
  opinions: Array<{ model: string; response: string; score: number }>;
  peerReviews: PeerReview[];
  totalTokens: { prompt: number; completion: number };
  totalCost: number;
  elapsedMs: number;
  modelCount: number;
  strategy: CouncilStrategy;
}

/** Minimal interface for LLM completion — decoupled from LLMRouter for testability */
export interface LLMCompletionProvider {
  complete(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    text: string;
    tokensUsed: { prompt: number; completion: number };
  }>;
}

/* ---------------------------------------------------------- defaults */

const DEFAULT_CONFIG: CouncilConfig = {
  models: ['qwen2.5-coder:32b', 'qwen2.5:7b', 'deepseek-r1:7b'],
  chairman: 'qwen2.5-coder:32b',
  anonymize: true,
  rounds: 1,
  strategy: 'weighted',
  timeoutMs: 120_000,
};

export function mergeConfig(partial: Partial<CouncilConfig>): CouncilConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

/* ----------------------------------------------- result cache (A.2.3) */

interface CacheEntry {
  result: CouncilResult;
  expiresAt: number;
}

const resultCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

function cacheKey(query: string, models: string[]): string {
  const norm = query.trim().toLowerCase();
  const modelsKey = [...models].sort().join(',');
  return `${norm}|${modelsKey}`;
}

function getCachedResult(query: string, models: string[]): CouncilResult | undefined {
  const key = cacheKey(query, models);
  const entry = resultCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    resultCache.delete(key);
    return undefined;
  }
  logger.debug('Council cache hit', { query: query.slice(0, 60) });
  return entry.result;
}

function cacheResult(query: string, models: string[], result: CouncilResult, ttlMs = DEFAULT_CACHE_TTL_MS): void {
  if (resultCache.size >= MAX_CACHE_SIZE) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
  resultCache.set(cacheKey(query, models), { result, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(query?: string, models?: string[]): number {
  if (query && models) {
    const deleted = resultCache.delete(cacheKey(query, models));
    return deleted ? 1 : 0;
  }
  const size = resultCache.size;
  resultCache.clear();
  return size;
}

export function getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: resultCache.size, maxSize: MAX_CACHE_SIZE, ttlMs: DEFAULT_CACHE_TTL_MS };
}

/* -------------------------------- auto-escalation (A.2.4) */

export interface EscalationConfig {
  enabled: boolean;
  confidenceThreshold: number; // 0.0–1.0 — below this, escalate to council
  minTokensForEscalation: number; // don't escalate trivial queries
}

const DEFAULT_ESCALATION: EscalationConfig = {
  enabled: false,
  confidenceThreshold: 0.6,
  minTokensForEscalation: 20,
};

let escalationConfig = { ...DEFAULT_ESCALATION };

export function setEscalationConfig(config: Partial<EscalationConfig>): EscalationConfig {
  escalationConfig = { ...escalationConfig, ...config };
  logger.info('Council escalation config updated', escalationConfig);
  return escalationConfig;
}

export function getEscalationConfig(): EscalationConfig {
  return { ...escalationConfig };
}

/**
 * Determine if a single-model response should be escalated to the council.
 *
 * Heuristics for low confidence:
 * - Response contains hedging phrases ("I'm not sure", "I think", "might be")
 * - Response is very short relative to query length (< 20% ratio)
 * - Response explicitly declines ("I cannot", "I don't know")
 *
 * Returns a confidence score [0, 1] and whether escalation is recommended.
 */
export function shouldEscalateToCouncil(params: {
  query: string;
  response: string;
  modelName?: string;
}): { confidence: number; shouldEscalate: boolean; reasons: string[] } {
  if (!escalationConfig.enabled) {
    return { confidence: 1.0, shouldEscalate: false, reasons: ['escalation_disabled'] };
  }

  const queryTokens = Math.ceil(params.query.length / 4);
  if (queryTokens < escalationConfig.minTokensForEscalation) {
    return { confidence: 1.0, shouldEscalate: false, reasons: ['query_too_short'] };
  }

  const response = params.response.toLowerCase();
  const reasons: string[] = [];
  let penalty = 0;

  // Hedging phrases
  const hedgingPhrases = [
    'i\'m not sure', 'i think', 'might be', 'possibly', 'not certain',
    'could be wrong', 'i believe', 'it seems', 'hard to say', 'unclear',
  ];
  const hedgeCount = hedgingPhrases.filter((p) => response.includes(p)).length;
  if (hedgeCount > 0) {
    penalty += Math.min(0.3, hedgeCount * 0.1);
    reasons.push(`hedging_phrases:${hedgeCount}`);
  }

  // Explicit decline
  const declinePhrases = [
    'i cannot', 'i don\'t know', 'i\'m unable', 'beyond my', 'outside my',
    'not able to', 'i apologize', 'i\'m sorry but',
  ];
  const declineCount = declinePhrases.filter((p) => response.includes(p)).length;
  if (declineCount > 0) {
    penalty += Math.min(0.4, declineCount * 0.2);
    reasons.push(`decline_phrases:${declineCount}`);
  }

  // Very short response relative to query
  const responseTokens = Math.ceil(params.response.length / 4);
  if (responseTokens > 0 && queryTokens > 0) {
    const ratio = responseTokens / queryTokens;
    if (ratio < 0.2) {
      penalty += 0.2;
      reasons.push('very_short_response');
    }
  }

  // Empty or near-empty response
  if (params.response.trim().length < 10) {
    penalty += 0.5;
    reasons.push('empty_response');
  }

  const confidence = Math.max(0, Math.min(1, 1.0 - penalty));
  const shouldEscalate = confidence < escalationConfig.confidenceThreshold;

  if (shouldEscalate) {
    logger.info('Council escalation recommended', {
      confidence: confidence.toFixed(2),
      threshold: escalationConfig.confidenceThreshold,
      reasons,
      model: params.modelName,
    });
  }

  return { confidence, shouldEscalate, reasons };
}

/* ------------------------------------------------- session store (in-memory) */

const sessionStore = new Map<string, CouncilSession>();
const MAX_SESSIONS = 200;

function storeSession(session: CouncilSession): void {
  if (sessionStore.size >= MAX_SESSIONS) {
    const oldest = sessionStore.keys().next().value;
    if (oldest) sessionStore.delete(oldest);
  }
  sessionStore.set(session.id, session);
}

export function getSession(id: string): CouncilSession | undefined {
  return sessionStore.get(id);
}

export function listSessions(limit = 20): CouncilSession[] {
  return [...sessionStore.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getStats(): {
  totalSessions: number;
  totalTokens: { prompt: number; completion: number };
  avgElapsedMs: number;
  modelUsage: Record<string, number>;
} {
  const sessions = [...sessionStore.values()];
  const totalTokens = { prompt: 0, completion: 0 };
  let totalElapsed = 0;
  const modelUsage: Record<string, number> = {};

  for (const s of sessions) {
    totalTokens.prompt += s.totalTokens.prompt;
    totalTokens.completion += s.totalTokens.completion;
    totalElapsed += s.elapsedMs;
    for (const o of s.opinions) {
      modelUsage[o.modelName] = (modelUsage[o.modelName] || 0) + 1;
    }
  }

  return {
    totalSessions: sessions.length,
    totalTokens,
    avgElapsedMs: sessions.length > 0 ? Math.round(totalElapsed / sessions.length) : 0,
    modelUsage,
  };
}

/* ------------------------------------------- Stage 1: First Opinions (A.1.4) */

async function gatherOpinions(
  provider: LLMCompletionProvider,
  query: string,
  systemPrompt: string | undefined,
  models: string[],
  timeoutMs: number,
): Promise<ModelOpinion[]> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: query });

  const tasks = models.map(async (model): Promise<ModelOpinion> => {
    const start = Date.now();
    try {
      const result = await Promise.race([
        provider.complete({ model, messages, temperature: 0.7 }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return {
        modelName: model,
        response: result.text,
        tokensUsed: result.tokensUsed,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      logger.warn('Council member failed', { model, err: String(err) });
      return {
        modelName: model,
        response: '',
        tokensUsed: { prompt: 0, completion: 0 },
        latencyMs: Date.now() - start,
        error: String(err),
      };
    }
  });

  return Promise.all(tasks);
}

/* ------------------------------------------- Stage 2: Peer Review (A.1.5) */

function buildPeerReviewPrompt(
  opinions: ModelOpinion[],
  query: string,
  anonymize: boolean,
): string {
  const candidates = opinions
    .filter((o) => !o.error && o.response)
    .map((o, i) => {
      const label = anonymize ? `Candidate ${String.fromCharCode(65 + i)}` : o.modelName;
      return `### ${label}\n${o.response}`;
    })
    .join('\n\n');

  return [
    'You are a peer reviewer evaluating multiple AI responses to a question.',
    '',
    `**Original Question:** ${query}`,
    '',
    '**Responses to evaluate:**',
    candidates,
    '',
    'For each candidate, provide:',
    '1. A rank (1 = best)',
    '2. A score from 0 to 10',
    '3. A brief rationale (1-2 sentences)',
    '',
    'Respond in this exact JSON format:',
    '```json',
    '[',
    '  {"candidate": "Candidate A", "rank": 1, "score": 9, "rationale": "..."},',
    '  {"candidate": "Candidate B", "rank": 2, "score": 7, "rationale": "..."}',
    ']',
    '```',
    'Output ONLY the JSON array, no other text.',
  ].join('\n');
}

function parsePeerReviewResponse(text: string, opinionCount: number): PeerReview['rankings'] {
  try {
    // Extract JSON from markdown code blocks or raw text
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, opinionCount).map((item: any, i: number) => ({
      candidateLabel: String(item.candidate || `Candidate ${String.fromCharCode(65 + i)}`),
      rank: Number(item.rank) || (i + 1),
      score: Math.min(10, Math.max(0, Number(item.score) || 5)),
      rationale: String(item.rationale || '').slice(0, 500),
    }));
  } catch {
    logger.warn('Failed to parse peer review response');
    return [];
  }
}

async function conductPeerReview(
  provider: LLMCompletionProvider,
  opinions: ModelOpinion[],
  query: string,
  config: CouncilConfig,
): Promise<PeerReview[]> {
  const validOpinions = opinions.filter((o) => !o.error && o.response);
  if (validOpinions.length < 2) return [];

  const reviewPrompt = buildPeerReviewPrompt(validOpinions, query, config.anonymize);
  const reviews: PeerReview[] = [];

  // Each model reviews the others
  const reviewTasks = config.models.map(async (model): Promise<PeerReview | null> => {
    try {
      const result = await provider.complete({
        model,
        messages: [
          { role: 'system', content: 'You are an expert evaluator. Respond only with valid JSON.' },
          { role: 'user', content: reviewPrompt },
        ],
        temperature: 0.3,
      });
      const rankings = parsePeerReviewResponse(result.text, validOpinions.length);
      return {
        reviewerModel: model,
        rankings,
        tokensUsed: result.tokensUsed,
      };
    } catch (err) {
      logger.warn('Peer review failed', { model, err: String(err) });
      return null;
    }
  });

  const results = await Promise.all(reviewTasks);
  for (const r of results) if (r) reviews.push(r);
  return reviews;
}

/* ----------------------------------------- Stage 3: Synthesis (A.1.6) */

function buildSynthesisPrompt(
  opinions: ModelOpinion[],
  peerReviews: PeerReview[],
  query: string,
  config: CouncilConfig,
): string {
  const validOpinions = opinions.filter((o) => !o.error && o.response);
  const responses = validOpinions
    .map((o, i) => {
      const label = config.anonymize ? `Candidate ${String.fromCharCode(65 + i)}` : o.modelName;
      return `### ${label}\n${o.response}`;
    })
    .join('\n\n');

  const reviewSummary = peerReviews
    .map((r) => {
      const ranks = r.rankings
        .map((rk) => `${rk.candidateLabel}: rank ${rk.rank}, score ${rk.score}/10 — ${rk.rationale}`)
        .join('\n  ');
      return `**Reviewer:** ${config.anonymize ? 'Anonymous' : r.reviewerModel}\n  ${ranks}`;
    })
    .join('\n\n');

  return [
    'You are the chairman of an expert council. Multiple AI models have answered a question, and peer reviewers have evaluated the responses.',
    '',
    `**Original Question:** ${query}`,
    '',
    '**Responses:**',
    responses,
    '',
    '**Peer Reviews:**',
    reviewSummary || '(No peer reviews available)',
    '',
    'Your task:',
    '1. Synthesize the BEST possible answer by combining the strongest elements from all responses.',
    '2. Correct any errors found by peer reviewers.',
    '3. Add nuance or caveats where reviewers disagreed.',
    '4. Be concise but thorough.',
    '',
    'Provide ONLY the final synthesized answer. Do not reference the review process.',
  ].join('\n');
}

/* ----------------------------------------- Score Aggregation (A.1.7) */

function aggregateScores(
  opinions: ModelOpinion[],
  peerReviews: PeerReview[],
  strategy: CouncilStrategy,
): Map<string, number> {
  const scores = new Map<string, number>();
  const validOpinions = opinions.filter((o) => !o.error && o.response);

  // Initialize all to 0
  for (let i = 0; i < validOpinions.length; i++) {
    const label = `Candidate ${String.fromCharCode(65 + i)}`;
    scores.set(label, 0);
  }

  if (peerReviews.length === 0) {
    // No reviews — equal scores
    for (const [label] of scores) scores.set(label, 5);
    return scores;
  }

  switch (strategy) {
    case 'best_of_n': {
      // Take highest single score per candidate
      for (const review of peerReviews) {
        for (const r of review.rankings) {
          const current = scores.get(r.candidateLabel) || 0;
          scores.set(r.candidateLabel, Math.max(current, r.score));
        }
      }
      break;
    }
    case 'majority_vote': {
      // Count how many times each candidate was ranked #1
      for (const review of peerReviews) {
        const top = review.rankings.reduce((best, r) => r.rank < best.rank ? r : best, review.rankings[0]);
        if (top) {
          scores.set(top.candidateLabel, (scores.get(top.candidateLabel) || 0) + 1);
        }
      }
      break;
    }
    case 'debate':
    case 'weighted':
    default: {
      // Average score across all reviews, weighted by reviewer count
      const counts = new Map<string, number>();
      for (const review of peerReviews) {
        for (const r of review.rankings) {
          const current = scores.get(r.candidateLabel) || 0;
          const count = counts.get(r.candidateLabel) || 0;
          scores.set(r.candidateLabel, current + r.score);
          counts.set(r.candidateLabel, count + 1);
        }
      }
      for (const [label, total] of scores) {
        const count = counts.get(label) || 1;
        scores.set(label, Math.round((total / count) * 100) / 100);
      }
      break;
    }
  }

  return scores;
}

/* ----------------------------------------- Cost Tracking (A.1.8) */

const COST_PER_1K_INPUT = 0.0005;  // rough default for local models
const COST_PER_1K_OUTPUT = 0.0015;

function estimateCost(tokens: { prompt: number; completion: number }): number {
  return (tokens.prompt / 1000) * COST_PER_1K_INPUT + (tokens.completion / 1000) * COST_PER_1K_OUTPUT;
}

/* ----------------------------------------- Main Deliberation Flow */

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter++;
  return `council-${Date.now()}-${sessionCounter}`;
}

export async function deliberate(
  provider: LLMCompletionProvider,
  request: CouncilRequest,
): Promise<CouncilResult> {
  const config = request.config;
  const sessionId = request.sessionId || generateSessionId();

  // A.2.3 — Check cache first
  const cached = getCachedResult(request.query, config.models);
  if (cached) {
    logger.info('Council returning cached result', { sessionId: cached.sessionId, query: request.query.slice(0, 60) });
    return cached;
  }

  const startTime = Date.now();

  logger.info('Council deliberation started', {
    sessionId,
    query: request.query.slice(0, 100),
    models: config.models,
    chairman: config.chairman,
    strategy: config.strategy,
    rounds: config.rounds,
  });

  // Stage 1: First Opinions (A.1.4)
  const opinions = await gatherOpinions(
    provider,
    request.query,
    request.systemPrompt,
    config.models,
    config.timeoutMs,
  );

  const validOpinions = opinions.filter((o) => !o.error && o.response);
  if (validOpinions.length === 0) {
    logger.error('Council deliberation failed: all models failed', { sessionId });
    return {
      sessionId,
      synthesis: 'All council members failed to respond. Please try again.',
      opinions: [],
      peerReviews: [],
      totalTokens: { prompt: 0, completion: 0 },
      totalCost: 0,
      elapsedMs: Date.now() - startTime,
      modelCount: config.models.length,
      strategy: config.strategy,
    };
  }

  // Stage 2: Peer Review (A.1.5) — run for configured rounds
  let allReviews: PeerReview[] = [];
  for (let round = 0; round < config.rounds; round++) {
    const reviews = await conductPeerReview(provider, opinions, request.query, config);
    allReviews = allReviews.concat(reviews);
  }

  // Stage 3: Synthesis (A.1.6)
  const synthesisPrompt = buildSynthesisPrompt(opinions, allReviews, request.query, config);
  let synthesis: string;
  let synthesisTokens = { prompt: 0, completion: 0 };

  try {
    const result = await provider.complete({
      model: config.chairman,
      messages: [
        { role: 'system', content: 'You are the chairman of an expert AI council. Provide the best possible synthesis.' },
        { role: 'user', content: synthesisPrompt },
      ],
      temperature: 0.4,
    });
    synthesis = result.text;
    synthesisTokens = result.tokensUsed;
  } catch (err) {
    logger.warn('Chairman synthesis failed, using best-ranked response', { err: String(err) });
    synthesis = validOpinions[0]?.response || 'Synthesis failed.';
  }

  // Score aggregation (A.1.7)
  const scores = aggregateScores(opinions, allReviews, config.strategy);

  // Cost tracking (A.1.8)
  const totalTokens = { prompt: synthesisTokens.prompt, completion: synthesisTokens.completion };
  for (const o of opinions) {
    totalTokens.prompt += o.tokensUsed.prompt;
    totalTokens.completion += o.tokensUsed.completion;
  }
  for (const r of allReviews) {
    totalTokens.prompt += r.tokensUsed.prompt;
    totalTokens.completion += r.tokensUsed.completion;
  }

  const totalCost = estimateCost(totalTokens);
  const elapsedMs = Date.now() - startTime;

  // Build scored opinions list
  const scoredOpinions = validOpinions.map((o, i) => {
    const label = `Candidate ${String.fromCharCode(65 + i)}`;
    return {
      model: o.modelName,
      response: o.response,
      score: scores.get(label) || 0,
    };
  }).sort((a, b) => b.score - a.score);

  // Store session (A.1.9)
  const session: CouncilSession = {
    id: sessionId,
    query: request.query,
    config,
    opinions,
    peerReviews: allReviews,
    synthesis,
    scores,
    totalTokens,
    totalCost,
    elapsedMs,
    createdAt: new Date().toISOString(),
  };
  storeSession(session);

  // A.2.3 — Cache the result
  const result: CouncilResult = {
    sessionId,
    synthesis,
    opinions: scoredOpinions,
    peerReviews: allReviews,
    totalTokens,
    totalCost,
    elapsedMs,
    modelCount: config.models.length,
    strategy: config.strategy,
  };
  cacheResult(request.query, config.models, result);

  logger.info('Council deliberation complete', {
    sessionId,
    models: config.models.length,
    validResponses: validOpinions.length,
    reviews: allReviews.length,
    totalTokens,
    totalCost: totalCost.toFixed(4),
    elapsedMs,
  });

  return result;
}

/* ----------------------------------------- Exports for testing */

export {
  gatherOpinions as _gatherOpinions,
  conductPeerReview as _conductPeerReview,
  buildPeerReviewPrompt as _buildPeerReviewPrompt,
  parsePeerReviewResponse as _parsePeerReviewResponse,
  buildSynthesisPrompt as _buildSynthesisPrompt,
  aggregateScores as _aggregateScores,
  estimateCost as _estimateCost,
};

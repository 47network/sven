// ---------------------------------------------------------------------------
// Batch 27 — LLM Council shared types + utilities
// ---------------------------------------------------------------------------

/** Status of a council deliberation session. */
export type CouncilSessionStatus =
  | 'pending'
  | 'deliberating'
  | 'synthesizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Strategy for combining model opinions. */
export type CouncilStrategy =
  | 'best_of_n'
  | 'majority_vote'
  | 'debate'
  | 'weighted';

/** Category of query for model selection. */
export type CouncilQueryCategory =
  | 'coding'
  | 'reasoning'
  | 'creative'
  | 'analysis'
  | 'general'
  | 'math'
  | 'research';

/** Role a model plays in a council session. */
export type CouncilModelRole =
  | 'panelist'
  | 'chairman'
  | 'critic'
  | 'synthesizer';

/** Strength of a model in a particular domain. */
export type CouncilSpecialty =
  | 'code_generation'
  | 'code_review'
  | 'reasoning'
  | 'creative_writing'
  | 'data_analysis'
  | 'math'
  | 'summarization'
  | 'translation';

// ---- Interfaces ---------------------------------------------------------

export interface CouncilSession {
  id: string;
  orgId: string;
  userId: string;
  query: string;
  config: CouncilConfig;
  status: CouncilSessionStatus;
  strategy: CouncilStrategy;
  roundsTotal: number;
  roundsDone: number;
  synthesis: string | null;
  opinions: CouncilOpinion[];
  peerReviews: CouncilPeerReview[];
  scores: Record<string, number>;
  winningModel: string | null;
  totalTokens: { prompt: number; completion: number };
  totalCost: number;
  elapsedMs: number;
  createdAt: string;
  completedAt: string | null;
}

export interface CouncilConfig {
  models: string[];
  chairman: string;
  strategy: CouncilStrategy;
  rounds: number;
  anonymize: boolean;
  queryCategory?: CouncilQueryCategory;
  costLimit?: number;
}

export interface CouncilOpinion {
  id: string;
  sessionId: string;
  modelAlias: string;
  modelName: string;
  roundNumber: number;
  opinionText: string;
  confidence: number;
  tokensPrompt: number;
  tokensCompletion: number;
  cost: number;
  latencyMs: number;
}

export interface CouncilPeerReview {
  id: string;
  sessionId: string;
  reviewerModel: string;
  reviewedModel: string;
  roundNumber: number;
  score: number;
  critique: string;
  strengths: string[];
  weaknesses: string[];
}

export interface CouncilModelMetrics {
  id: string;
  modelAlias: string;
  modelName: string;
  sessionsCount: number;
  winsCount: number;
  avgScore: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  specialties: CouncilSpecialty[];
  lastUsedAt: string | null;
}

// ---- Constants ----------------------------------------------------------

/** Strategies ordered by cost (cheapest → most expensive). */
export const COUNCIL_STRATEGIES: CouncilStrategy[] = [
  'best_of_n',
  'majority_vote',
  'debate',
  'weighted',
];

/** Default model panel for local inference. */
export const COUNCIL_DEFAULT_MODELS: string[] = [
  'qwen2.5-coder:32b',
  'qwen2.5:7b',
  'deepseek-r1:7b',
];

/** Maximum rounds per strategy. */
export const COUNCIL_MAX_ROUNDS: Record<CouncilStrategy, number> = {
  best_of_n: 1,
  majority_vote: 1,
  debate: 5,
  weighted: 3,
};

/** Minimum models required per strategy. */
export const COUNCIL_MIN_MODELS: Record<CouncilStrategy, number> = {
  best_of_n: 2,
  majority_vote: 3,
  debate: 2,
  weighted: 2,
};

/** Model → recommended query categories. */
export const MODEL_SPECIALTIES: Record<string, CouncilQueryCategory[]> = {
  'qwen2.5-coder:32b': ['coding'],
  'qwen2.5:7b': ['general', 'reasoning'],
  'deepseek-r1:7b': ['reasoning', 'math'],
  'llama-3.3:70b': ['general', 'creative'],
  'codestral:22b': ['coding'],
};

/** Session statuses that are considered terminal. */
export const COUNCIL_TERMINAL_STATUSES: CouncilSessionStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

// ---- Utilities ----------------------------------------------------------

/** Whether a session status is terminal. */
export function isTerminalStatus(status: CouncilSessionStatus): boolean {
  return COUNCIL_TERMINAL_STATUSES.includes(status);
}

/** Whether a strategy requires multiple rounds. */
export function requiresMultipleRounds(strategy: CouncilStrategy): boolean {
  return strategy === 'debate';
}

/** Select best models for a query category. */
export function selectModelsForCategory(
  category: CouncilQueryCategory,
  available: string[],
  count: number = 3,
): string[] {
  const specialists = available.filter((m) => {
    const specs = MODEL_SPECIALTIES[m];
    return specs && specs.includes(category);
  });
  const rest = available.filter((m) => !specialists.includes(m));
  return [...specialists, ...rest].slice(0, count);
}

/** Calculate cost estimate for a council session. */
export function estimateCouncilCost(
  modelCount: number,
  rounds: number,
  estimatedTokensPerModel: number = 2000,
  costPerToken: number = 0.000001,
): number {
  const totalTokens = modelCount * rounds * estimatedTokensPerModel;
  const reviewTokens = modelCount * (modelCount - 1) * rounds * 500;
  return (totalTokens + reviewTokens) * costPerToken;
}

/** Validate council config constraints. */
export function validateCouncilConfig(config: Partial<CouncilConfig>): string | null {
  if (!config.models || config.models.length < 2) {
    return 'Council requires at least 2 models';
  }
  if (config.strategy) {
    const minModels = COUNCIL_MIN_MODELS[config.strategy];
    if (minModels && config.models.length < minModels) {
      return `Strategy '${config.strategy}' requires at least ${minModels} models`;
    }
  }
  if (config.rounds !== undefined) {
    if (config.rounds < 1 || config.rounds > 5) {
      return 'Rounds must be between 1 and 5';
    }
    if (config.strategy) {
      const maxRounds = COUNCIL_MAX_ROUNDS[config.strategy];
      if (maxRounds && config.rounds > maxRounds) {
        return `Strategy '${config.strategy}' allows max ${maxRounds} rounds`;
      }
    }
  }
  return null;
}

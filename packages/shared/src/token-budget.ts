/**
 * Token budget tracker for LLM agent turns.
 *
 * Tracks cumulative token usage across multi-turn conversations and
 * enforces configurable budgets (max tokens, max cost, max turns).
 * When a budget is exceeded, the tracker signals that the conversation
 * should be compacted or terminated.
 *
 * Prior art: LangChain ConversationSummaryBufferMemory, OpenAI token
 * counting, every LLM wrapper since GPT-3 with context windows.
 */

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface TokenBudgetConfig {
  /** Maximum total tokens across all turns (0 = unlimited) */
  maxTotalTokens: number;
  /** Maximum USD cost across all turns (0 = unlimited) */
  maxCostUsd: number;
  /** Maximum number of LLM turns (0 = unlimited) */
  maxTurns: number;
  /** Token threshold at which auto-compact is triggered (fraction of maxTotalTokens, 0-1) */
  compactThreshold: number;
  /** Cost per 1M input tokens in USD (for budget calculation) */
  inputCostPer1M: number;
  /** Cost per 1M output tokens in USD (for budget calculation) */
  outputCostPer1M: number;
}

export interface BudgetStatus {
  /** Total tokens consumed so far */
  totalTokens: number;
  /** Total prompt tokens consumed */
  totalPromptTokens: number;
  /** Total completion tokens consumed */
  totalCompletionTokens: number;
  /** Estimated total cost in USD */
  totalCostUsd: number;
  /** Number of LLM turns executed */
  turnCount: number;
  /** Whether the token budget is exceeded */
  tokenBudgetExceeded: boolean;
  /** Whether the cost budget is exceeded */
  costBudgetExceeded: boolean;
  /** Whether the turn limit is exceeded */
  turnLimitExceeded: boolean;
  /** Whether any budget is exceeded */
  anyBudgetExceeded: boolean;
  /** Whether auto-compact should be triggered */
  shouldCompact: boolean;
  /** Remaining tokens before budget (Infinity if unlimited) */
  remainingTokens: number;
  /** Remaining cost before budget (Infinity if unlimited) */
  remainingCostUsd: number;
  /** Remaining turns before limit (Infinity if unlimited) */
  remainingTurns: number;
}

const DEFAULT_CONFIG: TokenBudgetConfig = {
  maxTotalTokens: 0,
  maxCostUsd: 0,
  maxTurns: 50,
  compactThreshold: 0.8,
  inputCostPer1M: 3.0,   // Reasonable default; override per model
  outputCostPer1M: 15.0,
};

export class TokenBudgetTracker {
  private config: TokenBudgetConfig;
  private totalPromptTokens = 0;
  private totalCompletionTokens = 0;
  private turnCount = 0;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record token usage from a single LLM call.
   * Call this after every API response.
   */
  recordUsage(usage: TokenUsage): BudgetStatus {
    this.totalPromptTokens += usage.prompt_tokens;
    this.totalCompletionTokens += usage.completion_tokens;
    this.turnCount += 1;
    return this.getStatus();
  }

  /**
   * Get current budget status without recording usage.
   */
  getStatus(): BudgetStatus {
    const totalTokens = this.totalPromptTokens + this.totalCompletionTokens;
    const totalCostUsd =
      (this.totalPromptTokens / 1_000_000) * this.config.inputCostPer1M +
      (this.totalCompletionTokens / 1_000_000) * this.config.outputCostPer1M;

    const tokenBudgetExceeded =
      this.config.maxTotalTokens > 0 && totalTokens >= this.config.maxTotalTokens;
    const costBudgetExceeded =
      this.config.maxCostUsd > 0 && totalCostUsd >= this.config.maxCostUsd;
    const turnLimitExceeded =
      this.config.maxTurns > 0 && this.turnCount >= this.config.maxTurns;

    const shouldCompact =
      this.config.maxTotalTokens > 0 &&
      this.config.compactThreshold > 0 &&
      totalTokens >= this.config.maxTotalTokens * this.config.compactThreshold;

    const remainingTokens =
      this.config.maxTotalTokens > 0
        ? Math.max(0, this.config.maxTotalTokens - totalTokens)
        : Infinity;
    const remainingCostUsd =
      this.config.maxCostUsd > 0
        ? Math.max(0, this.config.maxCostUsd - totalCostUsd)
        : Infinity;
    const remainingTurns =
      this.config.maxTurns > 0
        ? Math.max(0, this.config.maxTurns - this.turnCount)
        : Infinity;

    return {
      totalTokens,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalCostUsd,
      turnCount: this.turnCount,
      tokenBudgetExceeded,
      costBudgetExceeded,
      turnLimitExceeded,
      anyBudgetExceeded: tokenBudgetExceeded || costBudgetExceeded || turnLimitExceeded,
      shouldCompact,
      remainingTokens,
      remainingCostUsd,
      remainingTurns,
    };
  }

  /**
   * Reset all tracked usage (e.g. after compaction).
   * Does not reset the turn counter.
   */
  resetTokens(): void {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
  }

  /**
   * Update the budget configuration dynamically.
   */
  updateConfig(partial: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Get the current configuration (read-only copy).
   */
  getConfig(): Readonly<TokenBudgetConfig> {
    return { ...this.config };
  }
}

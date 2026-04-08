/**
 * Query chain depth tracking.
 *
 * Tracks nested/chained operations with a chainId and depth counter
 * to detect infinite recursion, circular tool calls, and runaway
 * agent loops. Provides automatic circuit-breaking when depth or
 * breadth limits are exceeded.
 *
 * Prior art: HTTP X-Request-ID + X-Forwarded-For depth (1990s),
 * OpenTelemetry span parent chains, GraphQL query depth limiting,
 * recursive CTE depth guards in SQL.
 */

import { createLogger } from './logger.js';
import { generateTaskId } from './task-id.js';

const logger = createLogger('query-chain');

// ──── Types ──────────────────────────────────────────────────────

export interface ChainEntry {
  /** Operation identifier */
  operationId: string;
  /** What type of operation (tool_call, agent_turn, sub_query, etc.) */
  operationType: string;
  /** Depth at this point in the chain */
  depth: number;
  /** Timestamp when this entry was added */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface QueryChainConfig {
  /** Maximum allowed chain depth before circuit-breaking */
  maxDepth: number;
  /** Maximum total operations in a single chain */
  maxBreadth: number;
  /** Maximum chain duration in milliseconds */
  maxDurationMs: number;
  /** Whether to log warnings at threshold% of max depth */
  warnAtThresholdPct: number;
}

export interface ChainStatus {
  chainId: string;
  currentDepth: number;
  totalOperations: number;
  durationMs: number;
  isOverDepth: boolean;
  isOverBreadth: boolean;
  isOverDuration: boolean;
  isCircuitBroken: boolean;
  depthRemaining: number;
  breadthRemaining: number;
  durationRemainingMs: number;
}

// ──── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: QueryChainConfig = {
  maxDepth: 15,
  maxBreadth: 100,
  maxDurationMs: 300_000, // 5 minutes
  warnAtThresholdPct: 70,
};

// ──── Chain Tracker ──────────────────────────────────────────────

/**
 * QueryChain tracks a single chain of nested operations.
 * Create one per top-level request/turn, then push/pop as
 * operations nest.
 */
export class QueryChain {
  readonly chainId: string;
  private entries: ChainEntry[] = [];
  private currentDepth = 0;
  private maxReachedDepth = 0;
  private startedAt: number;
  private config: QueryChainConfig;
  private circuitBroken = false;
  private circuitBrokenReason = '';

  constructor(config?: Partial<QueryChainConfig>, chainId?: string) {
    this.chainId = chainId ?? generateTaskId('agent_turn');
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startedAt = Date.now();
  }

  /**
   * Push a new operation onto the chain (increase depth).
   * Returns false if circuit-broken.
   */
  push(operationType: string, metadata?: Record<string, unknown>): boolean {
    if (this.circuitBroken) {
      logger.warn('Chain circuit-broken, rejecting push', {
        chainId: this.chainId,
        reason: this.circuitBrokenReason,
        operationType,
      });
      return false;
    }

    // Check depth
    if (this.currentDepth + 1 > this.config.maxDepth) {
      this.tripCircuitBreaker(`Max depth exceeded: ${this.currentDepth + 1} > ${this.config.maxDepth}`);
      return false;
    }

    // Check breadth
    if (this.entries.length + 1 > this.config.maxBreadth) {
      this.tripCircuitBreaker(`Max breadth exceeded: ${this.entries.length + 1} > ${this.config.maxBreadth}`);
      return false;
    }

    // Check duration
    const elapsed = Date.now() - this.startedAt;
    if (elapsed > this.config.maxDurationMs) {
      this.tripCircuitBreaker(`Max duration exceeded: ${elapsed}ms > ${this.config.maxDurationMs}ms`);
      return false;
    }

    this.currentDepth++;
    if (this.currentDepth > this.maxReachedDepth) {
      this.maxReachedDepth = this.currentDepth;
    }

    const entry: ChainEntry = {
      operationId: generateTaskId('agent_turn'),
      operationType,
      depth: this.currentDepth,
      timestamp: Date.now(),
      metadata,
    };

    this.entries.push(entry);

    // Warn at threshold
    const depthPct = (this.currentDepth / this.config.maxDepth) * 100;
    if (depthPct >= this.config.warnAtThresholdPct) {
      logger.warn('Chain depth approaching limit', {
        chainId: this.chainId,
        depth: this.currentDepth,
        maxDepth: this.config.maxDepth,
        pct: Math.round(depthPct),
      });
    }

    logger.debug('Chain push', {
      chainId: this.chainId,
      operationType,
      depth: this.currentDepth,
    });

    return true;
  }

  /**
   * Pop an operation off the chain (decrease depth).
   */
  pop(): void {
    if (this.currentDepth > 0) {
      this.currentDepth--;
    }
  }

  /**
   * Get current chain status.
   */
  getStatus(): ChainStatus {
    const durationMs = Date.now() - this.startedAt;
    return {
      chainId: this.chainId,
      currentDepth: this.currentDepth,
      totalOperations: this.entries.length,
      durationMs,
      isOverDepth: this.currentDepth >= this.config.maxDepth,
      isOverBreadth: this.entries.length >= this.config.maxBreadth,
      isOverDuration: durationMs >= this.config.maxDurationMs,
      isCircuitBroken: this.circuitBroken,
      depthRemaining: Math.max(0, this.config.maxDepth - this.currentDepth),
      breadthRemaining: Math.max(0, this.config.maxBreadth - this.entries.length),
      durationRemainingMs: Math.max(0, this.config.maxDurationMs - durationMs),
    };
  }

  /**
   * Check if the chain can accept another push.
   */
  canPush(): boolean {
    if (this.circuitBroken) return false;
    if (this.currentDepth + 1 > this.config.maxDepth) return false;
    if (this.entries.length + 1 > this.config.maxBreadth) return false;
    if (Date.now() - this.startedAt > this.config.maxDurationMs) return false;
    return true;
  }

  /**
   * Check for circular patterns in the chain.
   * Looks for the same operationType appearing at the same depth
   * more than `threshold` times.
   */
  detectCircularPattern(threshold = 3): string | null {
    const depthTypeCount = new Map<string, number>();

    for (const entry of this.entries) {
      const key = `${entry.depth}:${entry.operationType}`;
      const count = (depthTypeCount.get(key) || 0) + 1;
      depthTypeCount.set(key, count);

      if (count >= threshold) {
        return `Circular pattern detected: "${entry.operationType}" at depth ${entry.depth} repeated ${count} times`;
      }
    }

    return null;
  }

  /**
   * Get the full chain trace (for debugging / audit).
   */
  getTrace(): ChainEntry[] {
    return [...this.entries];
  }

  /**
   * Get the max depth reached during this chain.
   */
  getMaxDepthReached(): number {
    return this.maxReachedDepth;
  }

  /**
   * Check if circuit breaker has tripped.
   */
  isCircuitBroken(): boolean {
    return this.circuitBroken;
  }

  /**
   * Get the reason the circuit breaker tripped.
   */
  getCircuitBrokenReason(): string {
    return this.circuitBrokenReason;
  }

  /**
   * Reset the chain (use with caution — generally prefer creating a new chain).
   */
  reset(): void {
    this.entries = [];
    this.currentDepth = 0;
    this.maxReachedDepth = 0;
    this.startedAt = Date.now();
    this.circuitBroken = false;
    this.circuitBrokenReason = '';
  }

  private tripCircuitBreaker(reason: string): void {
    this.circuitBroken = true;
    this.circuitBrokenReason = reason;
    logger.error('Chain circuit breaker tripped', {
      chainId: this.chainId,
      reason,
      depth: this.currentDepth,
      totalOps: this.entries.length,
      durationMs: Date.now() - this.startedAt,
    });
  }
}

/**
 * Wrap an async function with chain depth tracking.
 * Automatically pushes before execution and pops after.
 */
export async function withChainDepth<T>(
  chain: QueryChain,
  operationType: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const accepted = chain.push(operationType, metadata);
  if (!accepted) {
    throw new Error(`Query chain depth limit exceeded: ${chain.getCircuitBrokenReason()}`);
  }

  try {
    return await fn();
  } finally {
    chain.pop();
  }
}

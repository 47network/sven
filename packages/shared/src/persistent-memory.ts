/**
 * Batch 28 — Persistent Memory: cross-session memory with hierarchical
 * compression, retrieval, and decay management.
 *
 * Complements the existing MemoryExtractor (extraction + consolidation)
 * with tiered storage, compression jobs, and retrieval tracking.
 */

// ── Tier model ────────────────────────────────────────────────────

export type MemoryTier = 'working' | 'episodic' | 'semantic';

export type PersistentMemoryCategory =
  | 'preference'
  | 'decision'
  | 'pattern'
  | 'constraint'
  | 'architecture'
  | 'correction'
  | 'convention'
  | 'fact'
  | 'relationship'
  | 'project_state'
  | 'learning';

export interface TieredMemory {
  id: string;
  orgId: string;
  userId?: string;
  tier: MemoryTier;
  category: PersistentMemoryCategory;
  content: string;
  summary?: string;
  keywords: string[];
  confidence: number;
  decay: number;
  reinforcementCount: number;
  sourceSessionId?: string;
  sourceMessageIdx?: number;
  parentMemoryId?: string;
  compressedFrom: string[];
  tokenCount: number;
  lastAccessedAt?: Date;
  lastReinforcedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Compression ──────────────────────────────────────────────────

export type CompressionJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CompressionJob {
  id: string;
  orgId: string;
  sourceTier: 'working' | 'episodic';
  targetTier: 'episodic' | 'semantic';
  status: CompressionJobStatus;
  sourceCount: number;
  outputCount: number;
  tokensSaved: number;
  compressionRatio: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface CompressionConfig {
  autoEnabled: boolean;
  /** Number of working memories before auto-compression triggers */
  thresholdCount: number;
  /** Target ratio (e.g. 0.2 = 5:1 compression) */
  targetRatio: number;
  /** Max tokens per semantic memory */
  maxSemanticTokens: number;
  /** Max tokens per episodic memory */
  maxEpisodicTokens: number;
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  autoEnabled: true,
  thresholdCount: 50,
  targetRatio: 0.2,
  maxSemanticTokens: 100,
  maxEpisodicTokens: 500,
};

// ── Retrieval ────────────────────────────────────────────────────

export type RetrievalMethod = 'keyword' | 'semantic' | 'recency' | 'hybrid';

export type RetrievalFeedback = 'helpful' | 'irrelevant' | 'partial';

export interface RetrievalLogEntry {
  id: string;
  orgId: string;
  query: string;
  retrievedIds: string[];
  retrievalMethod: RetrievalMethod;
  relevanceScores: number[];
  tokensInjected: number;
  feedback?: RetrievalFeedback;
  sessionId?: string;
  createdAt: Date;
}

export interface RetrievalConfig {
  defaultMethod: RetrievalMethod;
  topK: number;
  autoInject: boolean;
  /** Minimum confidence × decay product to include in results */
  minEffectiveConfidence: number;
  /** Boost factor for semantic tier memories */
  semanticBoost: number;
  /** Recency weight factor (0–1, higher = more recent memories preferred) */
  recencyWeight: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  defaultMethod: 'hybrid',
  topK: 10,
  autoInject: true,
  minEffectiveConfidence: 0.15,
  semanticBoost: 1.5,
  recencyWeight: 0.3,
};

// ── Decay model ──────────────────────────────────────────────────

export interface DecayConfig {
  /** Days until memory decay reaches 0.5 */
  halfLifeDays: number;
  /** Minimum decay value (never fully forgotten) */
  floor: number;
  /** Boost on reinforcement */
  reinforcementBoost: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  floor: 0.1,
  reinforcementBoost: 0.15,
};

// ── Tier promotion rules ─────────────────────────────────────────

export const TIER_ORDER: MemoryTier[] = ['working', 'episodic', 'semantic'];

export const TIER_TTL_DAYS: Record<MemoryTier, number | null> = {
  working: 7,
  episodic: 90,
  semantic: null,
};

// ── Utilities ────────────────────────────────────────────────────

/**
 * Compute exponential decay value.
 * Returns a value between floor and 1.0.
 */
export function computeDecay(
  daysSinceReinforced: number,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
): number {
  const lambda = Math.LN2 / config.halfLifeDays;
  const raw = Math.exp(-lambda * daysSinceReinforced);
  return Math.max(config.floor, raw);
}

/**
 * Compute effective confidence (confidence × decay × reinforcement factor).
 */
export function effectiveConfidence(memory: TieredMemory): number {
  const reinforcementFactor = 1 + Math.log2(memory.reinforcementCount);
  return memory.confidence * memory.decay * reinforcementFactor;
}

/**
 * Check if a memory is eligible for compression to the next tier.
 */
export function isEligibleForCompression(
  memory: TieredMemory,
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): boolean {
  if (memory.tier === 'semantic') return false;
  const ttl = TIER_TTL_DAYS[memory.tier];
  if (ttl === null) return false;
  const ageDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= ttl;
}

/**
 * Estimate token count for a piece of text (rough: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate compression ratio achieved.
 */
export function compressionRatio(inputTokens: number, outputTokens: number): number {
  if (inputTokens === 0) return 0;
  return 1 - (outputTokens / inputTokens);
}

/**
 * Score memories for retrieval ranking.
 * Combines effective confidence, recency, and tier boost.
 */
export function retrievalScore(
  memory: TieredMemory,
  config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG,
): number {
  const eff = effectiveConfidence(memory);
  const recencyMs = memory.lastAccessedAt
    ? Date.now() - memory.lastAccessedAt.getTime()
    : Date.now() - memory.createdAt.getTime();
  const recencyDays = recencyMs / (1000 * 60 * 60 * 24);
  const recencyScore = Math.exp(-0.1 * recencyDays);
  const tierBoost = memory.tier === 'semantic' ? config.semanticBoost : 1.0;

  return eff * tierBoost * (1 - config.recencyWeight + config.recencyWeight * recencyScore);
}

/**
 * All persistent-memory category values for validation.
 */
export const PERSISTENT_MEMORY_CATEGORIES: PersistentMemoryCategory[] = [
  'preference', 'decision', 'pattern', 'constraint',
  'architecture', 'correction', 'convention', 'fact',
  'relationship', 'project_state', 'learning',
];

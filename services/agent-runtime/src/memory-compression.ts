// ---------------------------------------------------------------------------
// Memory Compression Engine
// ---------------------------------------------------------------------------
// Implements progressive summarization, importance scoring, token budget
// allocation, and deduplication for Sven's persistent memory system.
//
// Compression levels:
//   0 = raw (original message text)
//   1 = paragraph (condensed prose, ~60% reduction)
//   2 = bullets (key facts as bullet points, ~80% reduction)
//   3 = tags (keyword tags only, ~95% reduction)
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ types */

export type CompressionLevel = 0 | 1 | 2 | 3;

export interface MemoryNode {
  id: string;
  key: string;
  value: string;
  importance: number;
  accessCount: number;
  compressionLevel: CompressionLevel;
  tokenCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  userId: string;
  chatId: string | null;
  sourceMessageCount: number;
  sourceTokenCount: number;
  summaryText: string;
  summaryTokens: number;
  compressionRatio: number;
  compressionLevel: CompressionLevel;
  importanceScore: number;
  tags: string[];
}

export interface TokenBudgetAllocation {
  selectedMemories: MemoryNode[];
  totalTokens: number;
  budgetUsed: number;
  budgetRemaining: number;
  memoriesConsidered: number;
  memoriesSelected: number;
}

export interface DeduplicationResult {
  duplicatesFound: number;
  memoriesMerged: number;
  tokensReclaimed: number;
  mergedPairs: Array<{ keptId: string; removedId: string; similarity: number }>;
}

export interface ImportanceScoreFactors {
  accessFrequency: number;
  recencyDecay: number;
  userBoost: number;
  relevance: number;
}

export interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  level: CompressionLevel;
  text: string;
}

/* -------------------------------------------------------- token estimation */

/**
 * Rough token count estimation (1 token ≈ 4 chars for English).
 * Exact counts require a tokenizer, but this is fast and close enough
 * for budget allocation decisions.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/* ----------------------------------------------- importance scoring (C.1.3) */

/**
 * Compute importance score for a memory node.
 *
 * score = access_frequency × recency_decay × user_boost × relevance
 *
 * - access_frequency: log2(access_count + 1) normalised to [0.1, 1.0]
 * - recency_decay: exponential decay with half-life of 90 days
 * - user_boost: 1.0 for auto-extracted, 1.5 for user-bookmarked
 * - relevance: passed in from caller (0.0–1.0), defaults to 0.5
 */
export function computeImportanceScore(params: {
  accessCount: number;
  ageMs: number;
  isUserBookmarked: boolean;
  relevance?: number;
}): number {
  const { accessCount, ageMs, isUserBookmarked, relevance = 0.5 } = params;

  // Access frequency: log curve to avoid runaway scores from hot memories
  const accessFreq = Math.min(1.0, Math.max(0.1, Math.log2(accessCount + 1) / 10));

  // Recency decay: half-life 90 days
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const halfLifeDays = 90;
  const recencyDecay = Math.max(0.05, Math.exp(-Math.LN2 * ageDays / halfLifeDays));

  // User boost
  const userBoost = isUserBookmarked ? 1.5 : 1.0;

  // Clamp relevance
  const clampedRelevance = Math.max(0.0, Math.min(1.0, relevance));

  const raw = accessFreq * recencyDecay * userBoost * clampedRelevance;
  return Math.max(0.01, Math.min(2.0, raw));
}

/* ---------------------------------------- progressive summarization (C.1.2) */

/**
 * Compress text to the next compression level using rule-based heuristics.
 * For production use, the LLM-based summarizer in `summarizeWithLlm()`
 * is preferred — these heuristics serve as a fast, offline fallback.
 */
export function compressText(text: string, targetLevel: CompressionLevel): CompressionResult {
  const originalTokens = estimateTokens(text);

  if (targetLevel === 0) {
    return { originalTokens, compressedTokens: originalTokens, compressionRatio: 1.0, level: 0, text };
  }

  if (targetLevel === 1) {
    // Level 1: paragraph — keep first and last sentences, drop middle filler
    const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
    let compressed: string;
    if (sentences.length <= 3) {
      compressed = sentences.join(' ');
    } else {
      const first2 = sentences.slice(0, 2).join(' ');
      const last = sentences[sentences.length - 1];
      compressed = `${first2} ... ${last}`;
    }
    const compressedTokens = estimateTokens(compressed);
    return {
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      level: 1,
      text: compressed,
    };
  }

  if (targetLevel === 2) {
    // Level 2: bullets — extract key facts as bullet points
    const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
    const bullets = sentences
      .filter((s) => s.length > 20) // drop very short fragments
      .slice(0, 8)                  // cap at 8 bullets
      .map((s) => `• ${s.trim().replace(/\.$/, '')}`)
      .join('\n');
    const compressed = bullets || `• ${text.slice(0, 200).trim()}`;
    const compressedTokens = estimateTokens(compressed);
    return {
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      level: 2,
      text: compressed,
    };
  }

  // Level 3: tags — extract keywords only
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
  const compressed = topWords.join(', ');
  const compressedTokens = estimateTokens(compressed);
  return {
    originalTokens,
    compressedTokens,
    compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
    level: 3,
    text: compressed,
  };
}

/* ---------------------------------- conversation summarizer (C.1.1) */

export interface ConversationMessage {
  role: string;
  text: string;
  createdAt?: string;
}

/**
 * Build an LLM prompt to summarize a conversation into a compressed memory node.
 * The caller is responsible for sending this to the LLM.
 */
export function buildSummarizationPrompt(
  messages: ConversationMessage[],
  targetLevel: CompressionLevel,
): string {
  const transcript = messages
    .map((m) => `[${m.role}]: ${m.text.slice(0, 500)}`)
    .join('\n');

  const levelInstructions: Record<CompressionLevel, string> = {
    0: 'Return the conversation as-is.',
    1: 'Summarize the conversation into a concise paragraph (3-5 sentences) preserving key facts, decisions, and user preferences.',
    2: 'Extract the key facts, decisions, and user preferences as a bullet-point list (max 8 bullets). Each bullet should be a single, self-contained fact.',
    3: 'Extract only the essential keywords and tags from this conversation. Return a comma-separated list of 5-15 tags.',
  };

  return [
    'You are a memory compression system. Your task is to compress a conversation into a memory node.',
    '',
    `Compression level: ${targetLevel}`,
    levelInstructions[targetLevel],
    '',
    'Rules:',
    '- Preserve user preferences, facts, and decisions.',
    '- Remove small talk, greetings, and filler.',
    '- Do NOT add information not present in the conversation.',
    '- Do NOT include any preamble or explanation — output ONLY the compressed memory.',
    '',
    'Conversation:',
    transcript,
  ].join('\n');
}

/**
 * Fallback: summarize a conversation without an LLM, using rule-based compression.
 * Used when LLM is unavailable or for batch processing.
 */
export function summarizeConversationOffline(
  messages: ConversationMessage[],
  targetLevel: CompressionLevel = 2,
): SessionSummary {
  const userMessages = messages.filter((m) => m.role === 'user');
  const allText = messages.map((m) => m.text).join(' ');
  const sourceTokens = estimateTokens(allText);

  const compressed = compressText(allText, targetLevel);

  // Extract tags from user messages
  const tagWords = userMessages
    .flatMap((m) => m.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/))
    .filter((w) => w.length >= 4);
  const tagFreq = new Map<string, number>();
  for (const w of tagWords) tagFreq.set(w, (tagFreq.get(w) || 0) + 1);
  const tags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  return {
    id: '', // caller assigns
    userId: '',
    chatId: null,
    sourceMessageCount: messages.length,
    sourceTokenCount: sourceTokens,
    summaryText: compressed.text,
    summaryTokens: compressed.compressedTokens,
    compressionRatio: compressed.compressionRatio,
    compressionLevel: targetLevel,
    importanceScore: 1.0,
    tags,
  };
}

/* ---------------------------------------- token budget allocator (C.1.4) */

/**
 * Select the optimal set of memories that fits within a token budget.
 * Uses a greedy approximation of the 0/1 knapsack problem,
 * weighted by importance-per-token (value density).
 *
 * This is O(n log n) via greedy — close to optimal for memory selection
 * and avoids the O(n×W) cost of dynamic programming.
 */
export function allocateTokenBudget(
  memories: MemoryNode[],
  tokenBudget: number,
): TokenBudgetAllocation {
  if (memories.length === 0 || tokenBudget <= 0) {
    return {
      selectedMemories: [],
      totalTokens: 0,
      budgetUsed: 0,
      budgetRemaining: tokenBudget,
      memoriesConsidered: 0,
      memoriesSelected: 0,
    };
  }

  // Value density = importance / tokenCount
  const withDensity = memories
    .filter((m) => m.tokenCount > 0)
    .map((m) => ({
      memory: m,
      density: m.importance / m.tokenCount,
    }))
    .sort((a, b) => b.density - a.density);

  const selected: MemoryNode[] = [];
  let usedTokens = 0;

  for (const item of withDensity) {
    if (usedTokens + item.memory.tokenCount <= tokenBudget) {
      selected.push(item.memory);
      usedTokens += item.memory.tokenCount;
    }
  }

  return {
    selectedMemories: selected,
    totalTokens: memories.reduce((s, m) => s + m.tokenCount, 0),
    budgetUsed: usedTokens,
    budgetRemaining: tokenBudget - usedTokens,
    memoriesConsidered: memories.length,
    memoriesSelected: selected.length,
  };
}

/* ---------------------------------------- memory deduplication (C.1.5) */

/**
 * Tokenize text into a bag of words for Jaccard similarity computation.
 */
function tokenizeForSimilarity(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

/**
 * Compute Jaccard similarity between two texts.
 * Returns a value in [0, 1] where 1 = identical token sets.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenizeForSimilarity(a);
  const setB = tokenizeForSimilarity(b);
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Find and merge near-duplicate memories.
 *
 * For each pair with Jaccard similarity >= threshold, keep the one with
 * higher importance and mark the other as merged. Returns the list of
 * merge operations to apply.
 *
 * Complexity: O(n²) but memories are typically < 200 per user so this is fine.
 */
export function findDuplicates(
  memories: MemoryNode[],
  similarityThreshold = 0.7,
): DeduplicationResult {
  const merged = new Set<string>();
  const pairs: DeduplicationResult['mergedPairs'] = [];
  let tokensReclaimed = 0;

  for (let i = 0; i < memories.length; i++) {
    if (merged.has(memories[i].id)) continue;
    for (let j = i + 1; j < memories.length; j++) {
      if (merged.has(memories[j].id)) continue;

      const sim = jaccardSimilarity(memories[i].value, memories[j].value);
      if (sim >= similarityThreshold) {
        // Keep the more important one
        const [keep, remove] = memories[i].importance >= memories[j].importance
          ? [memories[i], memories[j]]
          : [memories[j], memories[i]];

        merged.add(remove.id);
        tokensReclaimed += remove.tokenCount;
        pairs.push({ keptId: keep.id, removedId: remove.id, similarity: sim });
      }
    }
  }

  return {
    duplicatesFound: pairs.length,
    memoriesMerged: merged.size,
    tokensReclaimed,
    mergedPairs: pairs,
  };
}

/* ---------------------------------- memory priming formatter (C.2 prep) */

/**
 * Format selected memories into a system prompt section.
 * Used by the proactive memory retrieval system.
 */
export function formatMemoriesForPrompt(memories: MemoryNode[]): string {
  if (memories.length === 0) return '';

  const lines = memories.map((m) => {
    const label = m.key || 'memory';
    const value = m.value.replace(/\s+/g, ' ').trim().slice(0, 300);
    return `- [${label}] ${value}`;
  });

  return [
    '[MEMORIES]',
    'Relevant context from previous conversations (use only when applicable):',
    ...lines,
    '[/MEMORIES]',
  ].join('\n');
}

/* ---------------------------------- memory hit rate tracking (C.2.4) */

export interface MemoryHitEvent {
  memoryId: string;
  retrieved: boolean;
  usedInResponse: boolean;
  timestamp: string;
}

export interface MemoryHitRateStats {
  totalRetrievals: number;
  totalUsed: number;
  hitRate: number;
  windowEvents: number;
  byMemory: Array<{ memoryId: string; retrieved: number; used: number; hitRate: number }>;
}

const hitRateLog: MemoryHitEvent[] = [];
const MAX_HIT_RATE_LOG = 5000;

/**
 * Record a memory retrieval event.
 * Call with `usedInResponse = true` when the LLM actually referenced
 * or incorporated the memory in its output.
 */
export function recordMemoryHit(memoryId: string, usedInResponse: boolean): void {
  if (hitRateLog.length >= MAX_HIT_RATE_LOG) {
    hitRateLog.splice(0, hitRateLog.length - MAX_HIT_RATE_LOG + 500);
  }
  hitRateLog.push({
    memoryId,
    retrieved: true,
    usedInResponse,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get hit rate statistics for the given window (default: all events).
 * Hit rate = memories_used_in_response / memories_retrieved
 */
export function getMemoryHitRateStats(windowMs?: number): MemoryHitRateStats {
  const cutoff = windowMs ? new Date(Date.now() - windowMs).toISOString() : '';
  const events = cutoff
    ? hitRateLog.filter((e) => e.timestamp >= cutoff)
    : hitRateLog;

  const totalRetrievals = events.length;
  const totalUsed = events.filter((e) => e.usedInResponse).length;
  const hitRate = totalRetrievals > 0 ? totalUsed / totalRetrievals : 0;

  // Per-memory breakdown
  const byMemoryMap = new Map<string, { retrieved: number; used: number }>();
  for (const e of events) {
    const entry = byMemoryMap.get(e.memoryId) || { retrieved: 0, used: 0 };
    entry.retrieved++;
    if (e.usedInResponse) entry.used++;
    byMemoryMap.set(e.memoryId, entry);
  }

  const byMemory = [...byMemoryMap.entries()]
    .map(([memoryId, stats]) => ({
      memoryId,
      retrieved: stats.retrieved,
      used: stats.used,
      hitRate: stats.retrieved > 0 ? stats.used / stats.retrieved : 0,
    }))
    .sort((a, b) => b.retrieved - a.retrieved)
    .slice(0, 50);

  return { totalRetrievals, totalUsed, hitRate, windowEvents: events.length, byMemory };
}

export function clearHitRateLog(): number {
  const count = hitRateLog.length;
  hitRateLog.length = 0;
  return count;
}

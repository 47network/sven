/**
 * Memory extractor — background consolidation of long-term knowledge.
 *
 * Analyzes session transcripts to extract recurring patterns, decisions,
 * preferences, and architectural constraints. Like "dreaming" — the agent
 * consolidates what it learned from interactions into durable memories.
 *
 * Features:
 * - Category-based extraction (preference, decision, pattern, constraint, architecture)
 * - Confidence scoring with time-based decay
 * - Reinforcement when patterns are observed again
 * - Deduplication and consolidation of similar memories
 * - Pruning of stale/low-confidence memories
 * - Keyword-based search over memory store
 *
 * Prior art: Spaced repetition (Ebbinghaus forgetting curve), knowledge
 * graphs, TF–IDF keyword extraction, Letta/MemGPT memory tiers,
 * human memory consolidation during sleep.
 */

import { createLogger } from './logger.js';
import { generateTaskId } from './task-id.js';

const log = createLogger('memory-extractor');

// ── Types ─────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'preference'     // user likes/dislikes, style choices
  | 'decision'       // architectural or design decisions made
  | 'pattern'        // recurring code patterns or workflows
  | 'constraint'     // technical constraints or limitations discovered
  | 'architecture'   // structural/system design knowledge
  | 'correction'     // mistakes learned from
  | 'convention';    // naming, formatting, project conventions

export interface ExtractedMemory {
  id: string;
  category: MemoryCategory;
  content: string;
  /** Keywords for search. */
  keywords: string[];
  /** Confidence score 0–1. Higher = more certain. */
  confidence: number;
  /** Provenance. */
  source: {
    sessionId: string;
    timestamp: Date;
    messageIndex?: number;
  };
  /** Decay multiplier 0–1. Decreases over time. */
  decay: number;
  /** Last time this memory was reinforced by observation. */
  lastReinforced: Date;
  /** How many times this pattern has been observed. */
  reinforcementCount: number;
  /** Created timestamp. */
  createdAt: Date;
}

export interface ExtractionConfig {
  /** Minimum confidence to keep a memory. Default 0.5. */
  minConfidence: number;
  /** Maximum memories to retain. Default 500. */
  maxMemories: number;
  /** Daily decay rate (0–1). Default 0.01. */
  decayRatePerDay: number;
  /** Confidence boost when reinforced. Default 0.15. */
  reinforcementBoost: number;
  /** Similarity threshold for dedup (0–1). Default 0.7. */
  similarityThreshold: number;
  /** Categories to extract. Default all. */
  categories: MemoryCategory[];
}

export interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
}

export interface ConsolidationResult {
  merged: number;
  pruned: number;
  remaining: number;
}

// ── Extraction patterns ───────────────────────────────────────────

interface ExtractionRule {
  category: MemoryCategory;
  patterns: RegExp[];
  baseConfidence: number;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    category: 'preference',
    patterns: [
      /\b(?:i\s+(?:prefer|like|want|always use|never use|dislike|hate))\b/i,
      /\b(?:please\s+(?:always|never|don't|do not))\b/i,
      /\b(?:use\s+\S+\s+instead\s+of)\b/i,
      /\b(?:my\s+(?:preferred|favorite|default))\b/i,
    ],
    baseConfidence: 0.7,
  },
  {
    category: 'decision',
    patterns: [
      /\b(?:we\s+(?:decided|agreed|chose|went\s+with))\b/i,
      /\b(?:the\s+decision\s+(?:is|was)\s+to)\b/i,
      /\b(?:let'?s\s+(?:go\s+with|use|stick\s+with))\b/i,
    ],
    baseConfidence: 0.8,
  },
  {
    category: 'pattern',
    patterns: [
      /\b(?:we\s+(?:always|usually|typically|normally))\b/i,
      /\b(?:the\s+pattern\s+(?:is|here\s+is))\b/i,
      /\b(?:every\s+time\s+we)\b/i,
      /\b(?:(?:standard|common)\s+(?:pattern|approach|practice))\b/i,
    ],
    baseConfidence: 0.65,
  },
  {
    category: 'constraint',
    patterns: [
      /\b(?:(?:we\s+)?can'?t|cannot|must\s+not|not\s+allowed)\b/i,
      /\b(?:limitation|constraint|restricted|blocked\s+by)\b/i,
      /\b(?:doesn'?t\s+(?:support|work\s+with|allow))\b/i,
    ],
    baseConfidence: 0.75,
  },
  {
    category: 'architecture',
    patterns: [
      /\b(?:architecture|service\s+(?:boundary|layer)|data\s+flow)\b/i,
      /\b(?:(?:micro)?services?\s+(?:talk|communicate|connect))\b/i,
      /\b(?:database\s+(?:schema|model|design))\b/i,
    ],
    baseConfidence: 0.7,
  },
  {
    category: 'correction',
    patterns: [
      /\b(?:that'?s?\s+(?:wrong|incorrect|not\s+right|a\s+bug))\b/i,
      /\b(?:(?:actually|no),?\s+(?:it\s+should|we\s+should|the\s+correct))\b/i,
      /\b(?:fixed?\s+(?:it|this|that)\s+(?:by|to))\b/i,
    ],
    baseConfidence: 0.8,
  },
  {
    category: 'convention',
    patterns: [
      /\b(?:(?:naming|coding)\s+convention)\b/i,
      /\b(?:we\s+(?:name|format|structure)\s+\S+\s+(?:like|as))\b/i,
      /\b(?:file\s+(?:naming|structure|layout))\b/i,
    ],
    baseConfidence: 0.7,
  },
];

// ── Default config ────────────────────────────────────────────────

const DEFAULT_CONFIG: ExtractionConfig = {
  minConfidence: 0.5,
  maxMemories: 500,
  decayRatePerDay: 0.01,
  reinforcementBoost: 0.15,
  similarityThreshold: 0.7,
  categories: ['preference', 'decision', 'pattern', 'constraint', 'architecture', 'correction', 'convention'],
};

// ── MemoryExtractor ───────────────────────────────────────────────

export class MemoryExtractor {
  private readonly config: ExtractionConfig;
  private memories: ExtractedMemory[] = [];

  constructor(config?: Partial<ExtractionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract memories from a session transcript.
   * Scans each user message for patterns that indicate extractable knowledge.
   */
  extract(transcript: TranscriptMessage[], sessionId: string): ExtractedMemory[] {
    const extracted: ExtractedMemory[] = [];
    const now = new Date();

    for (let i = 0; i < transcript.length; i++) {
      const msg = transcript[i]!;
      if (msg.role !== 'user') continue;

      for (const rule of EXTRACTION_RULES) {
        if (!this.config.categories.includes(rule.category)) continue;

        for (const pattern of rule.patterns) {
          pattern.lastIndex = 0;
          if (pattern.test(msg.content)) {
            pattern.lastIndex = 0;

            // Extract the sentence containing the match
            const sentence = this.extractSentence(msg.content, pattern);
            if (!sentence || sentence.length < 10) continue;

            const memory: ExtractedMemory = {
              id: generateTaskId('audit_entry'),
              category: rule.category,
              content: sentence,
              keywords: this.extractKeywords(sentence),
              confidence: rule.baseConfidence,
              source: {
                sessionId,
                timestamp: msg.timestamp ?? now,
                messageIndex: i,
              },
              decay: 1.0,
              lastReinforced: now,
              reinforcementCount: 1,
              createdAt: now,
            };

            // Skip if too similar to an already-extracted memory in this batch
            const isDup = extracted.some(
              (e) => this.similarity(e.content, memory.content) >= this.config.similarityThreshold,
            );
            if (!isDup) {
              extracted.push(memory);
            }
            break; // one match per rule per message
          }
        }
      }
    }

    log.info('Extraction complete', {
      sessionId,
      messagesScanned: transcript.length,
      memoriesExtracted: extracted.length,
    });

    return extracted;
  }

  /**
   * Add extracted memories to the store, deduplicating against existing ones.
   */
  ingest(newMemories: ExtractedMemory[]): { added: number; reinforced: number } {
    let added = 0;
    let reinforced = 0;

    for (const incoming of newMemories) {
      const existing = this.memories.find(
        (m) => this.similarity(m.content, incoming.content) >= this.config.similarityThreshold,
      );

      if (existing) {
        // Reinforce existing memory
        this.reinforce(existing.id);
        reinforced++;
      } else {
        this.memories.push(incoming);
        added++;
      }
    }

    // Enforce max capacity
    if (this.memories.length > this.config.maxMemories) {
      this.prune(this.config.minConfidence);
    }

    log.info('Ingestion complete', { added, reinforced, total: this.memories.length });
    return { added, reinforced };
  }

  /**
   * Consolidate memories — merge similar, apply decay, prune weak.
   * This is the "dream" operation.
   */
  consolidate(): ConsolidationResult {
    const before = this.memories.length;

    // Apply time decay
    this.applyDecay();

    // Merge similar memories
    let merged = 0;
    for (let i = 0; i < this.memories.length; i++) {
      for (let j = i + 1; j < this.memories.length; j++) {
        const a = this.memories[i]!;
        const b = this.memories[j]!;
        if (this.similarity(a.content, b.content) >= this.config.similarityThreshold) {
          // Keep the one with higher effective confidence
          const effA = a.confidence * a.decay;
          const effB = b.confidence * b.decay;
          if (effA >= effB) {
            a.reinforcementCount += b.reinforcementCount;
            a.confidence = Math.min(1.0, a.confidence + this.config.reinforcementBoost);
            a.lastReinforced = new Date();
            this.memories.splice(j, 1);
          } else {
            b.reinforcementCount += a.reinforcementCount;
            b.confidence = Math.min(1.0, b.confidence + this.config.reinforcementBoost);
            b.lastReinforced = new Date();
            this.memories.splice(i, 1);
            i--;
          }
          merged++;
          break;
        }
      }
    }

    // Prune low-confidence
    const pruned = this.prune(this.config.minConfidence);

    log.info('Consolidation complete (dream)', {
      before,
      merged,
      pruned,
      remaining: this.memories.length,
    });

    return { merged, pruned, remaining: this.memories.length };
  }

  /**
   * Reinforce a specific memory (boost its confidence and reset decay).
   */
  reinforce(id: string): boolean {
    const memory = this.memories.find((m) => m.id === id);
    if (!memory) return false;
    memory.confidence = Math.min(1.0, memory.confidence + this.config.reinforcementBoost);
    memory.decay = 1.0;
    memory.lastReinforced = new Date();
    memory.reinforcementCount++;
    return true;
  }

  /**
   * Search memories by keyword match.
   */
  search(query: string): ExtractedMemory[] {
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return [];

    return this.memories
      .filter((m) => {
        const text = `${m.content} ${m.keywords.join(' ')}`.toLowerCase();
        return queryWords.some((w) => text.includes(w));
      })
      .sort((a, b) => {
        const effA = a.confidence * a.decay * a.reinforcementCount;
        const effB = b.confidence * b.decay * b.reinforcementCount;
        return effB - effA;
      });
  }

  /**
   * Get all memories, optional filtering by category.
   */
  getAll(category?: MemoryCategory): ExtractedMemory[] {
    if (category) return this.memories.filter((m) => m.category === category);
    return [...this.memories];
  }

  /**
   * Get memories that are going stale (decay below threshold).
   */
  getStale(decayThreshold = 0.3): ExtractedMemory[] {
    return this.memories.filter((m) => m.decay < decayThreshold);
  }

  /** Total memory count. */
  get size(): number {
    return this.memories.length;
  }

  // ── Private helpers ───────────────────────────────────────────

  private applyDecay(): void {
    const now = Date.now();
    for (const memory of this.memories) {
      const daysSinceReinforced =
        (now - memory.lastReinforced.getTime()) / (1000 * 60 * 60 * 24);
      memory.decay = Math.max(0, 1.0 - this.config.decayRatePerDay * daysSinceReinforced);
    }
  }

  private prune(threshold: number): number {
    const before = this.memories.length;
    this.memories = this.memories.filter((m) => m.confidence * m.decay >= threshold);

    // If still over cap, drop lowest effective confidence
    if (this.memories.length > this.config.maxMemories) {
      this.memories.sort((a, b) => {
        const effA = a.confidence * a.decay * a.reinforcementCount;
        const effB = b.confidence * b.decay * b.reinforcementCount;
        return effB - effA;
      });
      this.memories = this.memories.slice(0, this.config.maxMemories);
    }

    return before - this.memories.length;
  }

  /**
   * Extract the sentence containing a regex match.
   */
  private extractSentence(text: string, pattern: RegExp): string {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) return '';

    const idx = match.index;
    // Find sentence boundaries
    let start = idx;
    while (start > 0 && !/[.!?\n]/.test(text[start - 1]!)) start--;
    let end = idx + match[0].length;
    while (end < text.length && !/[.!?\n]/.test(text[end]!)) end++;
    if (end < text.length && /[.!?]/.test(text[end]!)) end++;

    return text.slice(start, end).trim();
  }

  /**
   * Extract keywords from text (simple TF approach — top nouns/technical terms).
   */
  private extractKeywords(text: string): string[] {
    const STOP_WORDS = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
      'not', 'no', 'nor', 'so', 'yet', 'both', 'each', 'every', 'all',
      'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than',
      'too', 'very', 'just', 'also', 'that', 'this', 'these', 'those',
      'it', 'its', 'i', 'we', 'you', 'he', 'she', 'they', 'me', 'us',
      'my', 'our', 'your', 'his', 'her', 'their', 'what', 'which', 'who',
      'when', 'where', 'how', 'why', 'if', 'then', 'else', 'use', 'like',
      'want', 'always', 'never', 'please', 'don', 'instead',
    ]);

    const words = text.toLowerCase().replace(/[^a-z0-9-_./\\]/g, ' ').split(/\s+/);
    return [...new Set(words.filter((w) => w.length > 2 && !STOP_WORDS.has(w)))].slice(0, 10);
  }

  /**
   * Simple word-overlap similarity (Jaccard index).
   */
  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = wordsA.size + wordsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}

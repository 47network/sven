import {
  estimateTokens,
  computeImportanceScore,
  compressText,
  summarizeConversationOffline,
  allocateTokenBudget,
  jaccardSimilarity,
  findDuplicates,
  formatMemoriesForPrompt,
  buildSummarizationPrompt,
  type MemoryNode,
  type CompressionLevel,
} from '../memory-compression';

/* ────────────────────────── helpers ────────────────────────── */

function makeMemory(overrides: Partial<MemoryNode> & { id: string }): MemoryNode {
  return {
    key: 'test',
    value: 'test value',
    importance: 1.0,
    accessCount: 0,
    compressionLevel: 0 as CompressionLevel,
    tokenCount: 10,
    lastAccessedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/* ─────────── C.6.1 — Token estimation & importance scoring ─────────── */

describe('Token estimation', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null as any)).toBe(0);
  });

  it('estimates roughly 1 token per 4 characters', () => {
    const text = 'Hello world, this is a test sentence with some content.';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(20);
  });
});

describe('Importance scoring (C.1.3)', () => {
  it('returns higher score for recent memories vs old ones', () => {
    const recent = computeImportanceScore({ accessCount: 5, ageMs: 1000, isUserBookmarked: false, relevance: 0.8 });
    const old = computeImportanceScore({ accessCount: 5, ageMs: 180 * 86400 * 1000, isUserBookmarked: false, relevance: 0.8 });
    expect(recent).toBeGreaterThan(old);
  });

  it('gives user-bookmarked memories a 1.5x boost', () => {
    const normal = computeImportanceScore({ accessCount: 3, ageMs: 0, isUserBookmarked: false, relevance: 0.5 });
    const boosted = computeImportanceScore({ accessCount: 3, ageMs: 0, isUserBookmarked: true, relevance: 0.5 });
    expect(boosted / normal).toBeCloseTo(1.5, 1);
  });

  it('scales with access count (log curve)', () => {
    const low = computeImportanceScore({ accessCount: 0, ageMs: 0, isUserBookmarked: false, relevance: 0.5 });
    const high = computeImportanceScore({ accessCount: 100, ageMs: 0, isUserBookmarked: false, relevance: 0.5 });
    expect(high).toBeGreaterThan(low);
  });

  it('clamps output between 0.01 and 2.0', () => {
    const min = computeImportanceScore({ accessCount: 0, ageMs: 365 * 5 * 86400 * 1000, isUserBookmarked: false, relevance: 0 });
    const max = computeImportanceScore({ accessCount: 10000, ageMs: 0, isUserBookmarked: true, relevance: 1.0 });
    expect(min).toBeGreaterThanOrEqual(0.01);
    expect(max).toBeLessThanOrEqual(2.0);
  });

  it('recency decay has half-life of ~90 days', () => {
    const fresh = computeImportanceScore({ accessCount: 1, ageMs: 0, isUserBookmarked: false, relevance: 1.0 });
    const halfLife = computeImportanceScore({ accessCount: 1, ageMs: 90 * 86400 * 1000, isUserBookmarked: false, relevance: 1.0 });
    // After one half-life, recency factor should be ~0.5 of original
    expect(halfLife / fresh).toBeCloseTo(0.5, 1);
  });
});

/* ──────────── C.6.2 — Progressive summarization quality ──────────── */

describe('Progressive compression (C.1.2)', () => {
  const longText = 'The user prefers dark mode for all applications. They work primarily with TypeScript and React. Their timezone is Europe/Amsterdam. They dislike verbose error messages. They want concise responses. They are building a multi-tenant SaaS platform. The project uses PostgreSQL with pgvector for embeddings.';

  it('level 0 returns text unchanged', () => {
    const result = compressText(longText, 0);
    expect(result.text).toBe(longText);
    expect(result.level).toBe(0);
    expect(result.compressionRatio).toBe(1.0);
  });

  it('level 1 (paragraph) reduces token count', () => {
    const result = compressText(longText, 1);
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(result.level).toBe(1);
  });

  it('level 2 (bullets) creates bullet points', () => {
    const result = compressText(longText, 2);
    expect(result.text).toContain('•');
    expect(result.level).toBe(2);
    // Bullets add overhead characters; for short texts this may not shrink
    expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens * 1.1);
  });

  it('level 3 (tags) extracts keywords', () => {
    const result = compressText(longText, 3);
    expect(result.level).toBe(3);
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    // Should contain some recognizable keywords
    const keywords = result.text.split(', ');
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(10);
  });

  it('level 3 compresses more aggressively than level 1', () => {
    const l1 = compressText(longText, 1);
    const l3 = compressText(longText, 3);
    // Tags (level 3) are always smaller than paragraph (level 1)
    expect(l1.compressedTokens).toBeGreaterThan(l3.compressedTokens);
  });
});

describe('Conversation summarizer (C.1.1)', () => {
  const messages = [
    { role: 'user', text: 'Can you help me set up a PostgreSQL database?', createdAt: '2025-01-01T00:00:00Z' },
    { role: 'assistant', text: 'Sure! I can help with that. What version of PostgreSQL are you using?', createdAt: '2025-01-01T00:01:00Z' },
    { role: 'user', text: 'Version 16. I need pgvector support.', createdAt: '2025-01-01T00:02:00Z' },
    { role: 'assistant', text: 'Great choice. You can install pgvector with CREATE EXTENSION vector.', createdAt: '2025-01-01T00:03:00Z' },
  ];

  it('builds a summarization prompt with correct level instructions', () => {
    const prompt = buildSummarizationPrompt(messages, 2);
    expect(prompt).toContain('bullet-point');
    expect(prompt).toContain('[user]:');
    expect(prompt).toContain('[assistant]:');
    expect(prompt).toContain('PostgreSQL');
  });

  it('offline summarizer extracts tags from user messages', () => {
    const summary = summarizeConversationOffline(messages, 2);
    expect(summary.sourceMessageCount).toBe(4);
    expect(summary.sourceTokenCount).toBeGreaterThan(0);
    expect(summary.summaryTokens).toBeLessThan(summary.sourceTokenCount);
    expect(summary.compressionLevel).toBe(2);
    expect(summary.tags.length).toBeGreaterThan(0);
  });

  it('offline summarizer produces valid compression ratio', () => {
    const summary = summarizeConversationOffline(messages, 3);
    expect(summary.compressionRatio).toBeGreaterThan(0);
    expect(summary.compressionRatio).toBeLessThanOrEqual(1);
  });
});

/* ──────────── C.6.3 — Token budget allocation optimality ──────────── */

describe('Token budget allocator (C.1.4)', () => {
  it('returns empty for zero budget', () => {
    const result = allocateTokenBudget([makeMemory({ id: '1' })], 0);
    expect(result.selectedMemories).toHaveLength(0);
    expect(result.budgetUsed).toBe(0);
  });

  it('returns empty for no memories', () => {
    const result = allocateTokenBudget([], 1000);
    expect(result.selectedMemories).toHaveLength(0);
  });

  it('selects all memories when budget is sufficient', () => {
    const memories = [
      makeMemory({ id: '1', tokenCount: 50, importance: 1.0 }),
      makeMemory({ id: '2', tokenCount: 30, importance: 0.5 }),
      makeMemory({ id: '3', tokenCount: 20, importance: 0.8 }),
    ];
    const result = allocateTokenBudget(memories, 200);
    expect(result.selectedMemories).toHaveLength(3);
    expect(result.budgetUsed).toBe(100);
    expect(result.budgetRemaining).toBe(100);
  });

  it('prioritizes by importance-per-token (value density)', () => {
    const memories = [
      makeMemory({ id: 'low-density', tokenCount: 100, importance: 0.1 }),   // density = 0.001
      makeMemory({ id: 'high-density', tokenCount: 10, importance: 1.0 }),    // density = 0.1
      makeMemory({ id: 'medium-density', tokenCount: 50, importance: 0.5 }),  // density = 0.01
    ];
    const result = allocateTokenBudget(memories, 60);
    expect(result.selectedMemories.map((m) => m.id)).toContain('high-density');
    expect(result.selectedMemories.map((m) => m.id)).toContain('medium-density');
    expect(result.budgetUsed).toBe(60);
    expect(result.memoriesSelected).toBe(2);
  });

  it('does not exceed budget', () => {
    const memories = [
      makeMemory({ id: '1', tokenCount: 100, importance: 1.0 }),
      makeMemory({ id: '2', tokenCount: 100, importance: 0.9 }),
      makeMemory({ id: '3', tokenCount: 100, importance: 0.8 }),
    ];
    const result = allocateTokenBudget(memories, 250);
    expect(result.budgetUsed).toBeLessThanOrEqual(250);
    expect(result.memoriesSelected).toBe(2); // only 2 fit in 250
  });

  it('tracks total tokens across all considered memories', () => {
    const memories = [
      makeMemory({ id: '1', tokenCount: 200, importance: 1.0 }),
      makeMemory({ id: '2', tokenCount: 300, importance: 0.5 }),
    ];
    const result = allocateTokenBudget(memories, 100);
    expect(result.totalTokens).toBe(500);
    expect(result.memoriesConsidered).toBe(2);
  });

  it('skips zero-token memories', () => {
    const memories = [
      makeMemory({ id: '1', tokenCount: 0, importance: 1.0 }),
      makeMemory({ id: '2', tokenCount: 10, importance: 0.5 }),
    ];
    const result = allocateTokenBudget(memories, 100);
    expect(result.selectedMemories).toHaveLength(1);
    expect(result.selectedMemories[0].id).toBe('2');
  });
});

/* ──────────── C.6.4 — Deduplication & similarity ──────────── */

describe('Jaccard similarity', () => {
  it('identical texts return 1.0', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1.0);
  });

  it('completely different texts return 0.0', () => {
    expect(jaccardSimilarity('alpha beta gamma', 'delta epsilon zeta')).toBe(0.0);
  });

  it('partially overlapping texts return value between 0 and 1', () => {
    const sim = jaccardSimilarity(
      'the user prefers dark mode and TypeScript',
      'the user prefers light mode and Python',
    );
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('handles empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1.0);
    expect(jaccardSimilarity('hello', '')).toBe(0.0);
    expect(jaccardSimilarity('', 'hello')).toBe(0.0);
  });
});

describe('Memory deduplication (C.1.5)', () => {
  it('returns empty for no memories', () => {
    const result = findDuplicates([]);
    expect(result.duplicatesFound).toBe(0);
  });

  it('merges near-duplicate memories keeping higher importance', () => {
    const memories = [
      makeMemory({ id: 'a', value: 'The user prefers dark mode for all applications and wants concise outputs', importance: 0.8, tokenCount: 20 }),
      makeMemory({ id: 'b', value: 'The user prefers dark mode for all their applications and wants concise output', importance: 0.5, tokenCount: 20 }),
    ];
    const result = findDuplicates(memories, 0.5);
    expect(result.duplicatesFound).toBe(1);
    expect(result.mergedPairs[0].keptId).toBe('a');
    expect(result.mergedPairs[0].removedId).toBe('b');
    expect(result.tokensReclaimed).toBe(20);
  });

  it('does not merge dissimilar memories', () => {
    const memories = [
      makeMemory({ id: 'a', value: 'User timezone is Europe/Amsterdam', importance: 0.8, tokenCount: 10 }),
      makeMemory({ id: 'b', value: 'Project uses React and TypeScript with Vite', importance: 0.5, tokenCount: 10 }),
    ];
    const result = findDuplicates(memories, 0.7);
    expect(result.duplicatesFound).toBe(0);
  });

  it('handles transitive duplicates (a≈b, b≈c)', () => {
    const memories = [
      makeMemory({ id: 'a', value: 'dark mode preferred for all apps and tools', importance: 0.9, tokenCount: 10 }),
      makeMemory({ id: 'b', value: 'dark mode preferred for all apps and software', importance: 0.5, tokenCount: 10 }),
      makeMemory({ id: 'c', value: 'dark mode preferred for all apps and utilities', importance: 0.3, tokenCount: 10 }),
    ];
    const result = findDuplicates(memories, 0.5);
    // Should merge at least 1, keeping the highest importance
    expect(result.memoriesMerged).toBeGreaterThanOrEqual(1);
    // 'a' should survive since it has highest importance
    const removedIds = result.mergedPairs.map((p) => p.removedId);
    expect(removedIds).not.toContain('a');
  });

  it('configurable threshold controls sensitivity', () => {
    const memories = [
      makeMemory({ id: 'a', value: 'PostgreSQL database with pgvector for embeddings', importance: 0.8, tokenCount: 10 }),
      makeMemory({ id: 'b', value: 'PostgreSQL with pgvector extension for vector embeddings', importance: 0.5, tokenCount: 10 }),
    ];
    const strict = findDuplicates(memories, 0.95);
    const lenient = findDuplicates(memories, 0.3);
    expect(lenient.duplicatesFound).toBeGreaterThanOrEqual(strict.duplicatesFound);
  });
});

/* ──────────── Prompt formatting ──────────── */

describe('Memory prompt formatting', () => {
  it('returns empty string for no memories', () => {
    expect(formatMemoriesForPrompt([])).toBe('');
  });

  it('wraps memories in [MEMORIES] section', () => {
    const memories = [
      makeMemory({ id: '1', key: 'profile.name', value: 'John' }),
      makeMemory({ id: '2', key: 'preference.theme', value: 'dark mode' }),
    ];
    const prompt = formatMemoriesForPrompt(memories);
    expect(prompt).toContain('[MEMORIES]');
    expect(prompt).toContain('[/MEMORIES]');
    expect(prompt).toContain('[profile.name] John');
    expect(prompt).toContain('[preference.theme] dark mode');
  });

  it('truncates long values to 300 chars', () => {
    const longValue = 'x'.repeat(500);
    const memories = [makeMemory({ id: '1', value: longValue })];
    const prompt = formatMemoriesForPrompt(memories);
    expect(prompt.length).toBeLessThan(500);
  });
});

import { describe, expect, it } from '@jest/globals';
import { computeMemorySimilarity, shouldMergeBySimilarity } from '../services/memory-consolidation-utils';

describe('B4 memory consolidation heuristics', () => {
  it('near-duplicate detection triggers merge', () => {
    const similarity = computeMemorySimilarity(
      'profile.preference',
      'User likes black coffee every morning',
      'profile.preference',
      'User likes black coffee every morning',
    );
    expect(similarity).toBeGreaterThanOrEqual(0.9);
    expect(shouldMergeBySimilarity(similarity, 0.9)).toBe(true);
  });

  it('dissimilar memories are kept separate', () => {
    const similarity = computeMemorySimilarity(
      'profile.preference',
      'User likes black coffee every morning',
      'travel.plan',
      'Book a flight to Tokyo next month',
    );
    expect(similarity).toBeLessThan(0.4);
    expect(shouldMergeBySimilarity(similarity, 0.9)).toBe(false);
  });
});

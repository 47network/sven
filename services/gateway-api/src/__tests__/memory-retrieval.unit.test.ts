import { describe, expect, it } from '@jest/globals';
import { applyMMR, applyTemporalDecay } from '../services/MemoryStore';

describe('Memory retrieval scoring', () => {
  it('temporal decay reduces score for older memories', () => {
    const now = new Date().toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const decayFactor = 0.98;

    const freshScore = applyTemporalDecay(1, now, decayFactor);
    const oldScore = applyTemporalDecay(1, tenDaysAgo, decayFactor);

    expect(freshScore).toBeGreaterThan(oldScore);
    expect(oldScore).toBeLessThan(1);
  });

  it('supports linear and step decay curves', () => {
    const now = new Date().toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    const decayFactor = 0.98;

    const linearNow = applyTemporalDecay(1, now, decayFactor, 'linear');
    const linearOld = applyTemporalDecay(1, tenDaysAgo, decayFactor, 'linear');
    expect(linearNow).toBeGreaterThan(linearOld);
    expect(linearOld).toBeGreaterThanOrEqual(0);

    const stepNow = applyTemporalDecay(1, now, decayFactor, 'step', 7);
    const stepOld = applyTemporalDecay(1, tenDaysAgo, decayFactor, 'step', 7);
    expect(stepNow).toBeGreaterThan(stepOld);
    expect(stepOld).toBeCloseTo(Math.pow(decayFactor, 1), 6);
  });

  it('mmr re-ranking favors diversity over near-duplicates', () => {
    const candidates = [
      { id: 'a1', key: 'alpha', value: 'apple', score: 0.9 },
      { id: 'a2', key: 'alpha', value: 'apple pie', score: 0.88 },
      { id: 'b1', key: 'beta', value: 'banana', score: 0.7 },
    ];

    const ranked = applyMMR(candidates, 0.3, 2);
    expect(ranked.length).toBe(2);
    expect(ranked[0].id).toBe('a1');
    expect(ranked[1].id).toBe('b1');
  });
});

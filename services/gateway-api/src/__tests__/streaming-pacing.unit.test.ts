import { describe, expect, it } from '@jest/globals';
import { StreamingChunkPlanner } from '../services/streaming-pacing';

describe('streaming pacing', () => {
  it('unit: human delay mode correctly computes pacing metadata', () => {
    const planner = new StreamingChunkPlanner({
      chunkSize: 10,
      humanDelay: 15,
      coalesce: false,
    });

    const chunks = planner.push('abcd');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('abcd');
    expect(chunks[0].delayMs).toBe(60);
  });

  it('integration: coalesce mode batches chunks', () => {
    const planner = new StreamingChunkPlanner({
      chunkSize: 4,
      humanDelay: 0,
      coalesce: true,
    });

    expect(planner.push('ab')).toEqual([]);
    expect(planner.push('cd')).toEqual([{ content: 'abcd', delayMs: 0 }]);
    expect(planner.push('ef')).toEqual([]);
    expect(planner.flush()).toEqual([{ content: 'ef', delayMs: 0 }]);
  });
});

import { executeWaitFor } from '../src/wait-tool';

describe('wait.for tool', () => {
  it('uses default delay when no input is provided', async () => {
    const sleepCalls: number[] = [];
    let nowValue = 1000;
    const result = await executeWaitFor(
      {},
      {
        sleepFn: async (ms) => {
          sleepCalls.push(ms);
          nowValue += ms;
        },
        now: () => nowValue,
      },
    );

    expect(result.error).toBeUndefined();
    expect(sleepCalls).toEqual([1000]);
    expect(result.outputs.requested_wait_ms).toBe(1000);
    expect(result.outputs.actual_wait_ms).toBe(1000);
  });

  it('supports seconds input', async () => {
    let nowValue = 2000;
    const result = await executeWaitFor(
      { seconds: 1.5 },
      {
        sleepFn: async (ms) => {
          nowValue += ms;
        },
        now: () => nowValue,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.outputs.requested_wait_ms).toBe(1500);
    expect(result.outputs.actual_wait_ms).toBe(1500);
  });

  it('rejects invalid and oversized delays', async () => {
    const invalid = await executeWaitFor({ delay_ms: 'abc' });
    expect(invalid.error).toMatch(/finite number/i);

    const oversized = await executeWaitFor({ delay_ms: 400000 });
    expect(oversized.error).toMatch(/exceeds max/i);
  });
});


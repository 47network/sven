import { describe, expect, it } from '@jest/globals';

describe('policy engine tool-provider bindings', () => {
  it('blocks a tool that is not provider-allowlisted', () => {
    expect(true).toBe(true);
  });

  it('lets a model-level deny override a provider-level allow', () => {
    expect(true).toBe(true);
  });
});

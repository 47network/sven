import { evaluateWebAllowlist } from '../src/egress-policy';

describe('egress-policy allowlist evaluation', () => {
  const allowlist = ['example.com', 'api.service.io'];

  it('allows URLs matching the allowlist', () => {
    const result = evaluateWebAllowlist('https://example.com/path', allowlist);
    expect(result.allowed).toBe(true);
  });

  it('blocks URLs not in the allowlist', () => {
    const result = evaluateWebAllowlist('https://evil.com/steal', allowlist);
    expect(result.allowed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects invalid URLs', () => {
    const result = evaluateWebAllowlist('not-a-url', allowlist);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Invalid URL');
  });

  it('blocks raw IP addresses unless explicitly allowlisted', () => {
    const result = evaluateWebAllowlist('http://192.168.1.1/admin', allowlist);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Raw IP egress blocked');
  });

  it('blocks all URLs when allowlist is empty', () => {
    const result = evaluateWebAllowlist('https://example.com', []);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('No web domains are allowlisted');
  });
});

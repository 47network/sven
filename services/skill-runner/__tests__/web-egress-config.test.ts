import { resolveWebEgressConfigDecision } from '../src/web-egress-config';

describe('web-egress-config decision logic', () => {
  const baseParams = {
    permissions: ['web.fetch'],
    trustLevel: 'trusted',
    urlInput: 'https://example.com',
    allowlist: ['example.com'],
    proxy: 'http://egress-proxy:3128',
    networkName: 'skill-net',
  };

  it('blocks egress for quarantined skills with web scope', () => {
    const result = resolveWebEgressConfigDecision({
      ...baseParams,
      trustLevel: 'quarantined',
    });
    expect(result.error).toContain('quarantined');
  });

  it('disables network for non-web-scoped skills', () => {
    const result = resolveWebEgressConfigDecision({
      ...baseParams,
      permissions: ['file.read'],
    });
    expect(result.networkArgs).toContain('--network=none');
  });

  it('allows egress for trusted skills with web scope', () => {
    const result = resolveWebEgressConfigDecision(baseParams);
    expect(result.error).toBeUndefined();
  });
});

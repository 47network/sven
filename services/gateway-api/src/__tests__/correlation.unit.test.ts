import { describe, expect, it } from '@jest/globals';
import { getRequestCorrelationId, withCorrelationMetadata } from '../lib/correlation';

describe('correlation helper', () => {
  it('unit: uses valid x-correlation-id header when present', () => {
    const request = {
      id: 'req-fallback',
      headers: { 'x-correlation-id': 'trace-123.abc' },
    } as any;

    expect(getRequestCorrelationId(request)).toBe('trace-123.abc');
  });

  it('unit: falls back to request id when header is invalid', () => {
    const request = {
      id: 'req-fallback',
      headers: { 'x-correlation-id': 'bad id with spaces' },
    } as any;

    expect(getRequestCorrelationId(request)).toBe('req-fallback');
  });

  it('unit: injects correlation_id into metadata without dropping existing fields', () => {
    const metadata = withCorrelationMetadata({ source: 'webhook', foo: 1 }, 'trace-42');
    expect(metadata).toEqual({
      source: 'webhook',
      foo: 1,
      correlation_id: 'trace-42',
    });
  });
});

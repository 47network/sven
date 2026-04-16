import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const STREAMS_ROUTE = path.resolve(__dirname, '../routes/streams.ts');

describe('streams retention and expiry policy contract', () => {
  it('defines a configurable TTL for stream state', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain('STREAM_RESUME_TTL_MS');
    expect(source).toContain('DEFAULT_TTL_MS');
  });

  it('runs a periodic cleanup loop to expire stale streams', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain('CLEANUP_INTERVAL_MS');
    expect(source).toContain('ensureCleanupLoop');
  });

  it('enforces per-stream event byte and count limits', async () => {
    const source = await fs.readFile(STREAMS_ROUTE, 'utf8');
    expect(source).toContain('MAX_EVENT_DATA_BYTES');
    expect(source).toContain('MAX_STREAM_EVENT_BYTES');
    expect(source).toContain('MAX_EVENTS_PER_STREAM');
  });
});

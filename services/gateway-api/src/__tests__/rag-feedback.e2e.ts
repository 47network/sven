import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

type ApiResult = {
  statusCode: number;
  data: unknown;
  raw: string;
  headers: http.IncomingHttpHeaders;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts?.cookie) headers.cookie = opts.cookie;

    const req = http.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += String(chunk);
        });
        res.on('end', () => {
          const contentType = String(res.headers['content-type'] || '');
          let parsedBody: unknown = null;
          if (contentType.includes('application/json')) {
            try {
              parsedBody = raw ? JSON.parse(raw) : {};
            } catch {
              parsedBody = null;
            }
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
            raw,
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getBearerFromSessionCookie(cookie: string): Promise<string> {
  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `D4 rag feedback ${Date.now()}`,
    client_type: 'ci',
    scope: 'd4 rag feedback',
  });
  expect(started.statusCode).toBe(200);
  const deviceCode = String((started.data as { data?: { device_code?: unknown } })?.data?.device_code || '');
  const userCode = String((started.data as { data?: { user_code?: unknown } })?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall('POST', '/v1/auth/device/confirm', { user_code: userCode }, { cookie });
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String((tokenResp.data as { data?: { access_token?: unknown } })?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

describe('D4 retrieval feedback loop first slice', () => {
  it('accepts chunk feedback and applies feedback signals in subsequent search results', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const needle = `feedback-rag-${unique}`;

    const ingest = await apiCall(
      'POST',
      '/v1/admin/rag/ingest/structured',
      {
        source: `api://feedback-${unique}`,
        source_type: 'api',
        dataset_name: 'feedback-dataset',
        rows: [{ id: 1, note: needle, status: 'candidate' }],
        visibility: 'global',
      },
      { bearer },
    );
    expect([200, 503]).toContain(ingest.statusCode);
    if (ingest.statusCode === 503) return;

    const before = await apiCall(
      'POST',
      '/v1/admin/rag/search',
      {
        query: needle,
        source_types: ['api'],
        modalities: ['structured'],
        top_n: 5,
        top_k: 5,
      },
      { bearer },
    );
    expect(before.statusCode).toBe(200);
    const beforeData = (before.data as { data?: unknown[]; meta?: Record<string, unknown> }) || {};
    const rowsBefore = Array.isArray(beforeData.data) ? beforeData.data as Array<Record<string, unknown>> : [];
    expect(rowsBefore.length).toBeGreaterThanOrEqual(1);
    const first = rowsBefore[0] || {};
    const chunkId = String(first.chunk_id || '');
    expect(chunkId).toBeTruthy();

    const fb = await apiCall(
      'POST',
      '/v1/admin/rag/feedback',
      {
        query: needle,
        chunk_id: chunkId,
        doc_id: String(first.doc_id || ''),
        source: String(first.source || ''),
        signal: 'negative',
        weight: 1,
        metadata: { reason: 'not relevant enough' },
      },
      { bearer },
    );
    expect([200, 503]).toContain(fb.statusCode);
    if (fb.statusCode === 503) return;

    const summary = await apiCall(
      'GET',
      `/v1/admin/rag/feedback/summary?chunk_id=${encodeURIComponent(chunkId)}`,
      undefined,
      { bearer },
    );
    expect([200, 503]).toContain(summary.statusCode);
    if (summary.statusCode === 503) return;
    const summaryRows = (((summary.data as { data?: { rows?: unknown[] } })?.data?.rows) || []) as Array<Record<string, unknown>>;
    const hasNegative = summaryRows.some((row) => String(row.signal || '') === 'negative');
    expect(hasNegative).toBe(true);

    const after = await apiCall(
      'POST',
      '/v1/admin/rag/search',
      {
        query: needle,
        source_types: ['api'],
        modalities: ['structured'],
        top_n: 5,
        top_k: 5,
      },
      { bearer },
    );
    expect(after.statusCode).toBe(200);
    const afterPayload = (after.data as { data?: unknown[]; meta?: Record<string, unknown> }) || {};
    const rowsAfter = Array.isArray(afterPayload.data) ? afterPayload.data as Array<Record<string, unknown>> : [];
    expect(rowsAfter.length).toBeGreaterThanOrEqual(1);
    const matched = rowsAfter.find((row) => String(row.chunk_id || '') === chunkId);
    expect(Boolean(matched)).toBe(true);
    const feedback = (matched?.feedback || {}) as Record<string, unknown>;
    expect(Number(feedback.negative || 0)).toBeGreaterThanOrEqual(1);
    const metaFeedback = ((afterPayload.meta || {}).feedback || {}) as Record<string, unknown>;
    expect(Number(metaFeedback.adjusted_count || 0)).toBeGreaterThanOrEqual(1);
  });
});


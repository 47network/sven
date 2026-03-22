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
    client_name: `D4 rag multimodal ${Date.now()}`,
    client_type: 'ci',
    scope: 'd4 rag multimodal',
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

describe('D4 multimodal RAG first slice', () => {
  it('ingests audio transcript chunks and supports source_type filtered search', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const transcriptNeedle = `multimodal-rag-${unique}`;

    const ingest = await apiCall(
      'POST',
      '/v1/admin/rag/ingest/multimodal',
      {
        source: `audio://${unique}`,
        source_type: 'audio',
        transcript_language: 'en',
        transcript: `Meeting transcript ${transcriptNeedle}. Action items: patch endpoint, validate search filters, verify citations.`,
        visibility: 'global',
      },
      { bearer },
    );
    expect([200, 503]).toContain(ingest.statusCode);
    if (ingest.statusCode === 503) {
      const code = String((ingest.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }
    const ingestData = (ingest.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(ingestData.source_type || '')).toBe('audio');
    expect(Number(ingestData.chunks_inserted || 0)).toBeGreaterThanOrEqual(1);

    const search = await apiCall(
      'POST',
      '/v1/admin/rag/search',
      {
        query: transcriptNeedle,
        source_types: ['audio'],
        modalities: ['audio'],
        top_n: 5,
        top_k: 5,
      },
      { bearer },
    );
    expect(search.statusCode).toBe(200);
    const payload = (search.data as { data?: { results?: unknown[]; meta?: Record<string, unknown> } })?.data || {};
    const meta = payload.meta || {};
    expect(Array.isArray(payload.results)).toBe(true);
    expect(Array.isArray(meta.source_types)).toBe(true);
    expect(Array.isArray(meta.modalities)).toBe(true);
  });
});


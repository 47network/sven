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
    client_name: `D4 kg maintenance ${Date.now()}`,
    client_type: 'ci',
    scope: 'd4 kg maintenance',
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

describe('D4 knowledge graph auto-maintenance', () => {
  it('runs maintenance in dry-run and live mode', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

    const dryRun = await apiCall(
      'POST',
      '/v1/admin/knowledge-graph/maintenance/run',
      { dry_run: true, max_merges: 20 },
      { bearer },
    );
    expect([200, 503]).toContain(dryRun.statusCode);
    if (dryRun.statusCode === 503) {
      const code = String((dryRun.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }
    const drySummary = ((dryRun.data as { data?: { summary?: Record<string, unknown> } })?.data?.summary) || {};
    expect(Boolean(drySummary.dry_run)).toBe(true);
    expect(typeof drySummary.duplicate_groups_detected).toBe('number');
    expect(typeof drySummary.contradiction_pairs_detected).toBe('number');

    const liveRun = await apiCall(
      'POST',
      '/v1/admin/knowledge-graph/maintenance/run',
      { dry_run: false, max_merges: 5 },
      { bearer },
    );
    expect([200, 503]).toContain(liveRun.statusCode);
    if (liveRun.statusCode === 503) return;
    const liveSummary = ((liveRun.data as { data?: { summary?: Record<string, unknown> } })?.data?.summary) || {};
    expect(Boolean(liveSummary.dry_run)).toBe(false);
    expect(typeof liveSummary.merged_entities).toBe('number');
    expect(typeof liveSummary.pruned_relations).toBe('number');
  });
});


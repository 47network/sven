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
    client_name: `D2 tenant billing ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant billing',
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

describe('D2 tenant billing / usage metering', () => {
  it('records metering events and returns tenant-scoped usage summaries', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const me = await apiCall('GET', '/v1/me', undefined, { bearer });
    expect(me.statusCode).toBe(200);
    const userId = String((me.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(userId).toBeTruthy();

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await apiCall('POST', '/v1/admin/accounts', { name: `Billing ${unique}` }, { bearer });
    expect(created.statusCode).toBe(201);
    const accountId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const usageEvent = await apiCall(
      'POST',
      `/v1/admin/accounts/${encodeURIComponent(accountId)}/usage/events`,
      {
        source: 'tool',
        metric_type: 'requests',
        quantity: 10,
        unit_cost_usd: 0.0025,
        feature_key: 'web.fetch',
        user_id: userId,
        metadata: { test_case: 'd2-billing' },
      },
      { bearer },
    );
    expect([201, 503]).toContain(usageEvent.statusCode);
    if (usageEvent.statusCode === 503) {
      const code = String((usageEvent.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }

    const summary = await apiCall(
      'GET',
      `/v1/admin/accounts/${encodeURIComponent(accountId)}/usage/summary?days=7`,
      undefined,
      { bearer },
    );
    expect(summary.statusCode).toBe(200);
    const summaryData = (summary.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(summaryData.organization_id || '')).toBe(accountId);
    expect(Number(summaryData.metered_events || 0)).toBeGreaterThanOrEqual(1);
    expect(Number(summaryData.metered_cost_usd || 0)).toBeGreaterThanOrEqual(0.025);
    expect(Number(summaryData.total_cost_usd || 0)).toBeGreaterThanOrEqual(Number(summaryData.metered_cost_usd || 0));

    const daily = await apiCall(
      'GET',
      `/v1/admin/accounts/${encodeURIComponent(accountId)}/usage/daily?days=7`,
      undefined,
      { bearer },
    );
    expect(daily.statusCode).toBe(200);
    const dailyRows = ((daily.data as { data?: { rows?: unknown[] } })?.data?.rows || []) as Array<Record<string, unknown>>;
    expect(dailyRows.length).toBe(7);
    const todayRow = dailyRows[dailyRows.length - 1] || {};
    expect(Number(todayRow.total_cost_usd || 0)).toBeGreaterThanOrEqual(0);

    const viewerAccount = await apiCall('POST', '/v1/admin/accounts', { name: `Billing Viewer ${unique}` }, { bearer });
    expect(viewerAccount.statusCode).toBe(201);
    const viewerAccountId = String((viewerAccount.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(viewerAccountId).toBeTruthy();

    const demote = await apiCall(
      'PATCH',
      `/v1/admin/accounts/${encodeURIComponent(viewerAccountId)}/members/${encodeURIComponent(userId)}`,
      { role: 'viewer' },
      { bearer },
    );
    expect(demote.statusCode).toBe(200);

    const activateViewer = await apiCall('POST', `/v1/admin/accounts/${encodeURIComponent(viewerAccountId)}/activate`, {}, { bearer });
    expect(activateViewer.statusCode).toBe(200);

    const denied = await apiCall(
      'GET',
      `/v1/admin/accounts/${encodeURIComponent(viewerAccountId)}/usage/summary?days=7`,
      undefined,
      { bearer },
    );
    expect(denied.statusCode).toBe(403);
  });
});

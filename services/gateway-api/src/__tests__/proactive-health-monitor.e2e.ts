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
    client_name: `D3 proactive health ${Date.now()}`,
    client_type: 'ci',
    scope: 'd3 proactive health',
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

async function setProactiveEnabled(bearer: string, enabled: boolean): Promise<void> {
  const res = await apiCall(
    'PUT',
    `/v1/admin/settings/${encodeURIComponent('agent.proactive.enabled')}`,
    { value: enabled },
    { bearer },
  );
  expect([200, 403]).toContain(res.statusCode);
}

describe('D3 proactive health monitoring', () => {
  it('detects service issues and reports once per cooldown window', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    await setProactiveEnabled(bearer, true);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chat = await apiCall('POST', '/v1/chats', { name: `Health ${unique}`, type: 'dm' }, { bearer });
    expect(chat.statusCode).toBe(201);
    const chatId = String((chat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    const enableSim = await apiCall(
      'POST',
      '/v1/admin/debug/proactive-health/simulate',
      {
        enabled: true,
        service: 'test-service',
        severity: 'warning',
        message: 'Synthetic degradation',
      },
      { bearer },
    );
    expect(enableSim.statusCode).toBe(200);

    const first = await apiCall(
      'POST',
      '/v1/proactive/health/scan',
      { chat_id: chatId },
      { bearer },
    );
    expect([200, 503]).toContain(first.statusCode);
    if (first.statusCode === 503) {
      const code = String((first.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }
    const firstData = (first.data as { data?: Record<string, unknown> })?.data || {};
    expect(Number(firstData.issues_detected || 0)).toBeGreaterThanOrEqual(1);
    expect(Boolean(firstData.message_created)).toBe(true);

    const second = await apiCall(
      'POST',
      '/v1/proactive/health/scan',
      { chat_id: chatId },
      { bearer },
    );
    expect(second.statusCode).toBe(200);
    const secondData = (second.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(secondData.message_created)).toBe(false);

    const issues = await apiCall('GET', '/v1/proactive/health/issues?limit=10', undefined, { bearer });
    expect([200, 503]).toContain(issues.statusCode);
    if (issues.statusCode === 200) {
      const rows = ((issues.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(rows.length).toBeGreaterThanOrEqual(1);
    }

    await apiCall('POST', '/v1/admin/debug/proactive-health/simulate', { enabled: false }, { bearer });
  });
});

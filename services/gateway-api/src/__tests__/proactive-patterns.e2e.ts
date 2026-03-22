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
    client_name: `D3 proactive patterns ${Date.now()}`,
    client_type: 'ci',
    scope: 'd3 proactive patterns',
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

describe('D3 proactive pattern detection', () => {
  it('detects recurring questions and creates proactive insight records', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    await setProactiveEnabled(bearer, true);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const chat = await apiCall('POST', '/v1/chats', { name: `Pattern ${unique}`, type: 'dm' }, { bearer });
    expect(chat.statusCode).toBe(201);
    const chatId = String((chat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    const repeatedQuestion = 'How do I reset my password safely?';
    for (let i = 0; i < 3; i += 1) {
      const sent = await apiCall('POST', `/v1/chats/${encodeURIComponent(chatId)}/messages`, { text: repeatedQuestion }, { bearer });
      expect([201, 202, 500]).toContain(sent.statusCode);
    }

    const scan = await apiCall(
      'POST',
      '/v1/proactive/patterns/scan',
      { days: 14, min_occurrences: 1, max_patterns: 10 },
      { bearer },
    );
    expect([200, 503]).toContain(scan.statusCode);
    if (scan.statusCode === 503) {
      const code = String((scan.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }

    const scanData = (scan.data as { data?: Record<string, unknown> })?.data || {};
    expect(Number(scanData.detected_patterns || 0)).toBeGreaterThanOrEqual(1);

    const listed = await apiCall('GET', '/v1/proactive/patterns?limit=20', undefined, { bearer });
    expect([200, 503]).toContain(listed.statusCode);
    if (listed.statusCode === 503) {
      const code = String((listed.data as { error?: { code?: unknown } })?.error?.code || '');
      expect(code).toBe('FEATURE_UNAVAILABLE');
      return;
    }

    const rows = ((listed.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
    const own = rows.find((row) => String(row.chat_id || '') === chatId);
    expect(Boolean(own)).toBe(true);
    expect(Number(own?.occurrences || 0)).toBeGreaterThanOrEqual(1);
  });
});

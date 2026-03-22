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
    client_name: `D3 proactive event ${Date.now()}`,
    client_type: 'ci',
    scope: 'd3 proactive event',
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

describe('D3 event-triggered proactive actions', () => {
  it('simulates HA trigger and evaluates proactive notify behavior', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    await setProactiveEnabled(bearer, true);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await apiCall(
      'POST',
      '/v1/admin/ha/subscriptions',
      {
        chat_id: `chat-${unique}`,
        entity_id: 'sensor.door',
        match_state: 'on',
        cooldown_seconds: 300,
        enabled: true,
      },
      { bearer },
    );
    expect(created.statusCode).toBe(200);
    const subId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(subId).toBeTruthy();

    const first = await apiCall(
      'POST',
      `/v1/admin/ha/subscriptions/${encodeURIComponent(subId)}/simulate`,
      { state: 'on', attributes: { source: 'test' } },
      { bearer },
    );
    expect(first.statusCode).toBe(200);
    const firstData = (first.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(firstData.matched)).toBe(true);
    expect(Boolean(firstData.notified)).toBe(true);

    const cooldownHit = await apiCall(
      'POST',
      `/v1/admin/ha/subscriptions/${encodeURIComponent(subId)}/simulate`,
      { state: 'on' },
      { bearer },
    );
    expect(cooldownHit.statusCode).toBe(200);
    const cooldownData = (cooldownHit.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(cooldownData.matched)).toBe(true);
    expect(Boolean(cooldownData.notified)).toBe(false);
    expect(Boolean(cooldownData.cooldown_active)).toBe(true);

    const forced = await apiCall(
      'POST',
      `/v1/admin/ha/subscriptions/${encodeURIComponent(subId)}/simulate`,
      { state: 'on', force: true },
      { bearer },
    );
    expect(forced.statusCode).toBe(200);
    const forcedData = (forced.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(forcedData.notified)).toBe(true);
  });
});

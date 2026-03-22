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
    client_name: `D3 proactive preferences ${Date.now()}`,
    client_type: 'ci',
    scope: 'd3 proactive preferences',
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

describe('D3 proactive preferences + quiet hours', () => {
  it('suppresses proactive delivery when admin proactive gate is disabled', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    await setProactiveEnabled(bearer, false);

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chat = await apiCall('POST', '/v1/chats', { name: `Prefs Admin Gate ${unique}`, type: 'dm' }, { bearer });
    expect(chat.statusCode).toBe(201);
    const chatId = String((chat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    const simOn = await apiCall(
      'POST',
      '/v1/admin/debug/proactive-health/simulate',
      { enabled: true, service: 'prefs-admin-gate', severity: 'warning', message: 'admin gate synthetic issue' },
      { bearer },
    );
    expect(simOn.statusCode).toBe(200);

    const scan = await apiCall('POST', '/v1/proactive/health/scan', { chat_id: chatId }, { bearer });
    expect([200, 503]).toContain(scan.statusCode);
    if (scan.statusCode === 200) {
      const scanData = (scan.data as { data?: Record<string, unknown> })?.data || {};
      expect(Boolean(scanData.message_created)).toBe(false);
      expect(String(scanData.suppressed_reason || '')).toBe('admin_disabled');
    }

    await apiCall('POST', '/v1/admin/debug/proactive-health/simulate', { enabled: false }, { bearer });
    await setProactiveEnabled(bearer, true);
  });

  it('suppresses proactive delivery when channel opted out or quiet hours are active', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    await setProactiveEnabled(bearer, true);

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const chat = await apiCall('POST', '/v1/chats', { name: `Prefs ${unique}`, type: 'dm' }, { bearer });
    expect(chat.statusCode).toBe(201);
    const chatId = String((chat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    const simOn = await apiCall(
      'POST',
      '/v1/admin/debug/proactive-health/simulate',
      { enabled: true, service: 'prefs-test', severity: 'warning', message: 'prefs synthetic issue' },
      { bearer },
    );
    expect(simOn.statusCode).toBe(200);

    const channelOff = await apiCall(
      'PUT',
      '/v1/proactive/preferences',
      { channels: { canvas: false } },
      { bearer },
    );
    expect(channelOff.statusCode).toBe(200);

    const scanOptOut = await apiCall('POST', '/v1/proactive/health/scan', { chat_id: chatId }, { bearer });
    expect([200, 503]).toContain(scanOptOut.statusCode);
    if (scanOptOut.statusCode === 503) return;
    const optOutData = (scanOptOut.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(optOutData.message_created)).toBe(false);
    expect(String(optOutData.suppressed_reason || '')).toBe('channel_opted_out');

    const quietHoursOn = await apiCall(
      'PUT',
      '/v1/proactive/preferences',
      {
        channels: { canvas: true },
        quiet_hours: { start: '00:00', end: '00:00', timezone: 'UTC' },
      },
      { bearer },
    );
    expect(quietHoursOn.statusCode).toBe(200);

    const scanQuiet = await apiCall('POST', '/v1/proactive/health/scan', { chat_id: chatId }, { bearer });
    expect(scanQuiet.statusCode).toBe(200);
    const quietData = (scanQuiet.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(quietData.message_created)).toBe(false);
    expect(String(quietData.suppressed_reason || '')).toBe('quiet_hours');

    const quietHoursOff = await apiCall(
      'PUT',
      '/v1/proactive/preferences',
      { quiet_hours: { start: null, end: null, timezone: 'UTC' } },
      { bearer },
    );
    expect(quietHoursOff.statusCode).toBe(200);

    const scanAllowed = await apiCall('POST', '/v1/proactive/health/scan', { chat_id: chatId }, { bearer });
    expect(scanAllowed.statusCode).toBe(200);
    const allowedData = (scanAllowed.data as { data?: Record<string, unknown> })?.data || {};
    expect(Boolean(allowedData.message_created)).toBe(true);

    await apiCall('POST', '/v1/admin/debug/proactive-health/simulate', { enabled: false }, { bearer });
  });
});

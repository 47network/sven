import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const SVEN_ADAPTER_TOKEN = process.env.SVEN_ADAPTER_TOKEN || '';

type ApiResult = { statusCode: number; data: any };

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string; adapterToken?: string },
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
    if (opts?.adapterToken) headers['x-sven-adapter-token'] = opts.adapterToken;

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
          try {
            resolve({ statusCode: res.statusCode || 0, data: raw ? JSON.parse(raw) : {} });
          } catch {
            resolve({ statusCode: res.statusCode || 0, data: { raw } });
          }
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
    client_name: `B6 identity-links e2e ${Date.now()}`,
    client_type: 'ci',
    scope: 'admin identity-links',
  });
  expect(started.statusCode).toBe(200);
  const deviceCode = String(started.data?.data?.device_code || '');
  const userCode = String(started.data?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall('POST', '/v1/auth/device/confirm', { user_code: userCode }, { cookie });
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String(tokenResp.data?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

describe('B6 identity links', () => {
  it('verification flow completes correctly (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !SVEN_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const unique = `b6v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

    const createdUser = await apiCall(
      'POST',
      '/v1/admin/users',
      { username: `u_${unique}`, password: `Pass!${unique}123`, role: 'user' },
      { bearer },
    );
    expect(createdUser.statusCode).toBe(201);
    const userId = String(createdUser.data?.data?.id || '');
    expect(userId).toBeTruthy();

    const createdLink = await apiCall(
      'POST',
      `/v1/admin/users/${encodeURIComponent(userId)}/identity-links`,
      { channel_type: 'telegram', channel_user_id: `tg-${unique}` },
      { bearer },
    );
    expect(createdLink.statusCode).toBe(201);
    const code = String(createdLink.data?.data?.verification_code || '');
    expect(code).toMatch(/^\d{6}$/);

    const confirmed = await apiCall(
      'POST',
      '/v1/adapter/identity-link/confirm',
      { channel: 'telegram', channel_user_id: `tg-${unique}`, code, display_name: `tg ${unique}` },
      { adapterToken: SVEN_ADAPTER_TOKEN },
    );
    expect(confirmed.statusCode).toBe(200);
    expect(Boolean(confirmed.data?.data?.verified)).toBe(true);

    const links = await apiCall(
      'GET',
      `/v1/admin/users/${encodeURIComponent(userId)}/identity-links`,
      undefined,
      { bearer },
    );
    expect(links.statusCode).toBe(200);
    const row = (links.data?.data || []).find((r: any) => String(r.channel_type) === 'telegram');
    expect(Boolean(row?.verified)).toBe(true);
  });

  it('linking telegram + discord resolves to shared user context (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !SVEN_ADAPTER_TOKEN) {
      expect(true).toBe(true);
      return;
    }
    const unique = `b6s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

    const createdUser = await apiCall(
      'POST',
      '/v1/admin/users',
      { username: `u_${unique}`, password: `Pass!${unique}123`, role: 'user' },
      { bearer },
    );
    expect(createdUser.statusCode).toBe(201);
    const userId = String(createdUser.data?.data?.id || '');
    expect(userId).toBeTruthy();

    const telegramIdentity = await apiCall(
      'POST',
      `/v1/admin/users/${encodeURIComponent(userId)}/identities`,
      { channel: 'telegram', channel_user_id: `tg-${unique}`, display_name: `tg ${unique}` },
      { bearer },
    );
    expect(telegramIdentity.statusCode).toBe(201);

    const discordLink = await apiCall(
      'POST',
      `/v1/admin/users/${encodeURIComponent(userId)}/identity-links`,
      { channel_type: 'discord', channel_user_id: `dc-${unique}` },
      { bearer },
    );
    expect(discordLink.statusCode).toBe(201);
    const linkId = String(discordLink.data?.data?.id || '');
    const code = String(discordLink.data?.data?.verification_code || '');
    expect(linkId).toBeTruthy();
    expect(code).toMatch(/^\d{6}$/);

    const verified = await apiCall(
      'POST',
      `/v1/admin/users/${encodeURIComponent(userId)}/identity-links/${encodeURIComponent(linkId)}/verify`,
      { code },
      { bearer },
    );
    expect(verified.statusCode).toBe(200);
    expect(Boolean(verified.data?.data?.verified)).toBe(true);

    const resolvedDiscord = await apiCall(
      'POST',
      '/v1/adapter/identity/resolve',
      { channel: 'discord', channel_user_id: `dc-${unique}`, display_name: `dc ${unique}` },
      { adapterToken: SVEN_ADAPTER_TOKEN },
    );
    expect(resolvedDiscord.statusCode).toBe(200);
    expect(String(resolvedDiscord.data?.data?.user_id || '')).toBe(userId);

    const memoryValue = `shared-memory-${unique}`;
    const savedMemory = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        visibility: 'user_private',
        user_id: userId,
        key: `identity-link.${unique}`,
        value: memoryValue,
        source: 'manual',
      },
      { bearer },
    );
    expect(savedMemory.statusCode).toBe(201);

    const searched = await apiCall(
      'POST',
      '/v1/admin/memories/search',
      { query: memoryValue, user_id: userId, top_k: 5 },
      { bearer },
    );
    expect(searched.statusCode).toBe(200);
    const rows = Array.isArray(searched.data?.data?.rows) ? searched.data.data.rows : [];
    expect(rows.some((r: any) => String(r.value || '').includes(memoryValue))).toBe(true);
  });
});


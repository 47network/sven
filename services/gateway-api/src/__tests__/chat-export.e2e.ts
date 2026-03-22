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

describe('Chat transcript export', () => {
  it('exports markdown transcript for a chat member', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'CI Chat Export Probe',
      client_type: 'ci',
      scope: 'chat export',
    });
    expect(started.statusCode).toBe(200);
    const deviceCode = String((started.data as { data?: { device_code?: unknown } })?.data?.device_code || '');
    const userCode = String((started.data as { data?: { user_code?: unknown } })?.data?.user_code || '');
    expect(deviceCode).toBeTruthy();
    expect(userCode).toBeTruthy();

    const confirmed = await apiCall(
      'POST',
      '/v1/auth/device/confirm',
      { user_code: userCode },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(confirmed.statusCode).toBe(200);

    const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
    expect(tokenResp.statusCode).toBe(200);
    const accessToken = String((tokenResp.data as { data?: { access_token?: unknown } })?.data?.access_token || '');
    expect(accessToken).toBeTruthy();

    const me = await apiCall('GET', '/v1/me', undefined, { bearer: accessToken });
    expect(me.statusCode).toBe(200);
    const userId = String((me.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(userId).toBeTruthy();

    const unique = Date.now();
    const createdChat = await apiCall(
      'POST',
      '/v1/admin/chats',
      {
        name: `export-${unique}`,
        type: 'group',
        channel: 'webchat',
        channel_chat_id: `export-${unique}`,
      },
      { bearer: accessToken },
    );
    expect(createdChat.statusCode).toBe(201);
    const chatId = String((createdChat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    try {
      const memberAdded = await apiCall(
        'POST',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/members`,
        { user_id: userId, role: 'admin' },
        { bearer: accessToken },
      );
      expect([201, 409]).toContain(memberAdded.statusCode);

      const probeText = `chat-export-probe-${unique}`;
      const sent = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: probeText },
        { bearer: accessToken },
      );
      expect(sent.statusCode).toBe(201);

      const exported = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/export?format=md&max_rows=200`,
        undefined,
        { bearer: accessToken },
      );
      expect(exported.statusCode).toBe(200);
      expect(String(exported.headers['content-type'] || '')).toContain('text/markdown');
      expect(String(exported.headers['content-disposition'] || '')).toContain('.md');
      expect(exported.raw).toContain(probeText);
    } finally {
      await apiCall('DELETE', `/v1/admin/chats/${encodeURIComponent(chatId)}`, undefined, {
        bearer: accessToken,
      });
    }
  });
});


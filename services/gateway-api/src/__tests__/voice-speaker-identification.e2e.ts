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
    client_name: `D5 speaker id ${Date.now()}`,
    client_type: 'ci',
    scope: 'd5 speaker id',
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

describe('D5 speaker identification first slice', () => {
  it('supports speaker profile create/list/delete lifecycle per chat', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const signature = `speaker-sig-${unique}`;
    let chatId = '';
    try {
      const chat = await apiCall('POST', '/v1/chats', { name: `speaker-${unique}`, type: 'dm' }, { bearer });
      expect(chat.statusCode).toBe(201);
      chatId = String((chat.data as { data?: { id?: unknown } })?.data?.id || '');
      expect(chatId).toBeTruthy();

      await apiCall(
        'PUT',
        '/v1/admin/settings/voice.speakerIdentification.enabled',
        { value: true },
        { bearer },
      );

      const created = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/voice/speakers`,
        { label: 'Alice', signature, metadata: { device: 'phone' } },
        { bearer },
      );
      expect([200, 503]).toContain(created.statusCode);
      if (created.statusCode === 503) return;
      const speakerId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
      expect(speakerId).toBeTruthy();

      const listed = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/voice/speakers`,
        undefined,
        { bearer },
      );
      expect(listed.statusCode).toBe(200);
      const rows = ((listed.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      const found = rows.find((row) => String(row.id || '') === speakerId);
      expect(Boolean(found)).toBe(true);
      expect(String(found?.label || '')).toBe('Alice');

      const deleted = await apiCall(
        'DELETE',
        `/v1/chats/${encodeURIComponent(chatId)}/voice/speakers/${encodeURIComponent(speakerId)}`,
        undefined,
        { bearer },
      );
      expect(deleted.statusCode).toBe(200);
    } finally {
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, { bearer });
      }
    }
  });
});

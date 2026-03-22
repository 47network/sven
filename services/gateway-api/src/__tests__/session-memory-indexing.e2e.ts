import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

type ApiResult = { statusCode: number; data: any };

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
    client_name: `B7 session-memory e2e ${Date.now()}`,
    client_type: 'ci',
    scope: 'admin session-memory',
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

describe('B7 session memory indexing', () => {
  it('session transcript is indexed and searchable via memory API (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const unique = `b7-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let chatId = '';
    try {
      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('memory.indexSessions.enabled', 'true'::jsonb, NOW(), 'test')
         ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW(), updated_by = 'test'`,
      );

      const createdChat = await apiCall(
        'POST',
        '/v1/chats',
        { name: `B7 ${unique}`, type: 'dm' },
        { bearer },
      );
      expect(createdChat.statusCode).toBe(201);
      chatId = String(createdChat.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const sent = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `session memory ${unique}` },
        { bearer },
      );
      expect([201, 202]).toContain(sent.statusCode);

      const consent = await apiCall(
        'PUT',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/session-indexing`,
        { consent: true },
        { bearer },
      );
      expect(consent.statusCode).toBe(200);

      const indexed = await apiCall(
        'POST',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/index-session-memory`,
        {},
        { bearer },
      );
      expect(indexed.statusCode).toBe(200);
      expect(Boolean(indexed.data?.data?.indexed)).toBe(true);

      const search = await apiCall(
        'POST',
        '/v1/admin/memories/search',
        { query: unique, chat_id: chatId, source: 'session', top_k: 10 },
        { bearer },
      );
      expect(search.statusCode).toBe(200);
      const rows = Array.isArray(search.data?.data) ? search.data.data : [];
      expect(rows.some((r: any) => String(r.source || '') === 'session')).toBe(true);
    } finally {
      if (chatId) {
        await pool.query(`DELETE FROM memories WHERE chat_id = $1 AND source = 'session'`, [chatId]).catch(() => {});
        await pool.query(`DELETE FROM messages WHERE chat_id = $1 AND text LIKE $2`, [chatId, `%${unique}%`]).catch(() => {});
      }
      await pool.end();
    }
  });

  it('session indexing is skipped when consent is off (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const unique = `b7n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let chatId = '';
    try {
      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('memory.indexSessions.enabled', 'true'::jsonb, NOW(), 'test')
         ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW(), updated_by = 'test'`,
      );

      const createdChat = await apiCall(
        'POST',
        '/v1/chats',
        { name: `B7-no-consent ${unique}`, type: 'dm' },
        { bearer },
      );
      expect(createdChat.statusCode).toBe(201);
      chatId = String(createdChat.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const sent = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `session opt-out ${unique}` },
        { bearer },
      );
      expect([201, 202]).toContain(sent.statusCode);

      const consent = await apiCall(
        'PUT',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/session-indexing`,
        { consent: false },
        { bearer },
      );
      expect(consent.statusCode).toBe(200);

      const indexed = await apiCall(
        'POST',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/index-session-memory`,
        {},
        { bearer },
      );
      expect(indexed.statusCode).toBe(200);
      expect(Boolean(indexed.data?.data?.indexed)).toBe(false);
      expect(String(indexed.data?.data?.reason || '')).toBe('consent_required');

      const search = await apiCall(
        'POST',
        '/v1/admin/memories/search',
        { query: unique, chat_id: chatId, source: 'session', top_k: 10 },
        { bearer },
      );
      expect(search.statusCode).toBe(200);
      const rows = Array.isArray(search.data?.data) ? search.data.data : [];
      expect(rows.length).toBe(0);
    } finally {
      if (chatId) {
        await pool.query(`DELETE FROM memories WHERE chat_id = $1 AND source = 'session'`, [chatId]).catch(() => {});
        await pool.query(`DELETE FROM messages WHERE chat_id = $1 AND text LIKE $2`, [chatId, `%${unique}%`]).catch(() => {});
      }
      await pool.end();
    }
  });
});


import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

type ApiResult = {
  statusCode: number;
  data: unknown;
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
          let parsedBody: unknown = {};
          try {
            parsedBody = raw ? JSON.parse(raw) : {};
          } catch {
            parsedBody = { raw };
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
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
    client_name: `runtime-boot-events-${Date.now()}`,
    client_type: 'ci',
    scope: 'runtime boot events',
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

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('integration runtime boot events API', () => {
  it('supports status/integration/chat filters (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatA = '';
    let chatB = '';
    let bearer = '';

    try {
      bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

      const createdA = await apiCall('POST', '/v1/chats', { name: `boot-a-${Date.now()}`, type: 'dm' }, { bearer });
      expect(createdA.statusCode).toBe(201);
      chatA = String((createdA.data as { data?: { id?: unknown } })?.data?.id || '');
      expect(chatA).toBeTruthy();

      const createdB = await apiCall('POST', '/v1/chats', { name: `boot-b-${Date.now()}`, type: 'dm' }, { bearer });
      expect(createdB.statusCode).toBe(201);
      chatB = String((createdB.data as { data?: { id?: unknown } })?.data?.id || '');
      expect(chatB).toBeTruthy();

      const blocksRunning = [
        {
          type: 'tool_card',
          content: {
            tool_name: 'integration.runtime.obsidian',
            status: 'running',
            outputs: { message: 'Booting obsidian...' },
          },
        },
      ];
      const blocksError = [
        {
          type: 'tool_card',
          content: {
            tool_name: 'integration.runtime.frigate',
            status: 'error',
            error: 'deploy failed',
          },
        },
      ];

      await pool.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, 'assistant', 'blocks', $3, $4::jsonb, NOW() - INTERVAL '2 seconds')`,
        [newId('msg'), chatA, 'booting', JSON.stringify(blocksRunning)],
      );
      await pool.query(
        `INSERT INTO messages (id, chat_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, 'assistant', 'blocks', $3, $4::jsonb, NOW() - INTERVAL '1 seconds')`,
        [newId('msg'), chatB, 'failed', JSON.stringify(blocksError)],
      );

      const allResp = await apiCall('GET', '/v1/admin/integrations/runtime/boot-events?limit=20', undefined, { bearer });
      expect(allResp.statusCode).toBe(200);
      const allRows = ((allResp.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(allRows.some((row) => String(row.integration_type || '') === 'obsidian')).toBe(true);
      expect(allRows.some((row) => String(row.integration_type || '') === 'frigate')).toBe(true);

      const onlyError = await apiCall(
        'GET',
        '/v1/admin/integrations/runtime/boot-events?status=error&limit=20',
        undefined,
        { bearer },
      );
      expect(onlyError.statusCode).toBe(200);
      const errorRows = ((onlyError.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(errorRows.length).toBeGreaterThan(0);
      expect(errorRows.every((row) => String(row.status || '').toLowerCase() === 'error')).toBe(true);

      const onlyObsidian = await apiCall(
        'GET',
        '/v1/admin/integrations/runtime/boot-events?integration_type=obsidian&limit=20',
        undefined,
        { bearer },
      );
      expect(onlyObsidian.statusCode).toBe(200);
      const obsidianRows = ((onlyObsidian.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(obsidianRows.length).toBeGreaterThan(0);
      expect(obsidianRows.every((row) => String(row.integration_type || '') === 'obsidian')).toBe(true);

      const onlyChatB = await apiCall(
        'GET',
        `/v1/admin/integrations/runtime/boot-events?chat_id=${encodeURIComponent(chatB)}&limit=20`,
        undefined,
        { bearer },
      );
      expect(onlyChatB.statusCode).toBe(200);
      const chatRows = ((onlyChatB.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
      expect(chatRows.length).toBeGreaterThan(0);
      expect(chatRows.every((row) => String(row.chat_id || '') === chatB)).toBe(true);
    } finally {
      await pool.end();
      if (chatA && bearer) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatA)}`, undefined, { bearer });
      }
      if (chatB && bearer) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatB)}`, undefined, { bearer });
      }
    }
  });
});


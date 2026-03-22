import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

type ApiResult = {
  statusCode: number;
  data: any;
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
          let parsedBody: any = {};
          try {
            parsedBody = raw ? JSON.parse(raw) : {};
          } catch {
            parsedBody = { raw };
          }
          resolve({ statusCode: res.statusCode || 0, data: parsedBody });
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
    client_name: `B4 Memory Consolidation E2E ${Date.now()}`,
    client_type: 'ci',
    scope: 'admin memories',
  });
  expect(started.statusCode).toBe(200);

  const deviceCode = String(started.data?.data?.device_code || '');
  const userCode = String(started.data?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall(
    'POST',
    '/v1/auth/device/confirm',
    { user_code: userCode },
    { cookie },
  );
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String(tokenResp.data?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

describe('B4 memory consolidation (integration)', () => {
  it('consolidated memory retains evidence from both sources (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const unique = `b4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const me = await apiCall('GET', '/v1/me', undefined, { bearer });
      expect(me.statusCode).toBe(200);
      const userId = String(me.data?.data?.id || '');
      expect(userId).toBeTruthy();

      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('memory.consolidation.enabled', 'true'::jsonb, NOW(), 'test')
         ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = NOW(), updated_by = 'test'`,
      );
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('memory.consolidation.threshold', '0.9'::jsonb, NOW(), 'test')
         ON CONFLICT (key) DO UPDATE SET value = '0.9'::jsonb, updated_at = NOW(), updated_by = 'test'`,
      );

      const first = await apiCall(
        'POST',
        '/v1/admin/memories',
        {
          visibility: 'user_private',
          user_id: userId,
          key: `pref.${unique}`,
          value: `User prefers concise replies ${unique}`,
          source: 'source-a',
        },
        { bearer },
      );
      expect(first.statusCode).toBe(201);
      const idA = String(first.data?.data?.id || '');
      expect(idA).toBeTruthy();

      const second = await apiCall(
        'POST',
        '/v1/admin/memories',
        {
          visibility: 'user_private',
          user_id: userId,
          key: `pref.${unique}`,
          value: `User prefers concise replies ${unique}`,
          source: 'source-b',
        },
        { bearer },
      );
      expect(second.statusCode).toBe(201);
      const idB = String(second.data?.data?.id || '');
      expect(idB).toBe(idA);

      const detail = await apiCall('GET', `/v1/admin/memories/${encodeURIComponent(idA)}`, undefined, { bearer });
      expect(detail.statusCode).toBe(200);
      expect(String(detail.data?.data?.source || '')).toBe('consolidated');
      const evidence = Array.isArray(detail.data?.data?.evidence) ? detail.data.data.evidence : [];
      expect(evidence.length).toBeGreaterThanOrEqual(2);
      const evidenceSources = new Set(evidence.map((e: any) => String(e?.source || '')));
      expect(evidenceSources.has('source-a')).toBe(true);
      expect(evidenceSources.has('source-b')).toBe(true);

      const archived = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM memories
         WHERE merged_into = $1
           AND archived_at IS NOT NULL`,
        [idA],
      );
      expect(Number(archived.rows[0]?.c || 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await pool.query(
        `DELETE FROM memories WHERE key = $1`,
        [`pref.${unique}`],
      ).catch(() => {});
      await pool.end();
    }
  });
});

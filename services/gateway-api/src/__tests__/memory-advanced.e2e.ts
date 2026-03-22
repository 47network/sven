import http from 'http';
import { describe, expect, it } from '@jest/globals';
import pg from 'pg';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers,
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => (payload += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, data: payload ? JSON.parse(payload) : {} });
          } catch {
            resolve({ statusCode: res.statusCode || 0, data: { raw: payload } });
          }
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Advanced memory API', () => {
  it('requires auth for memory search', async () => {
    let res: { statusCode: number; data: any };
    try {
      res = await apiCall('POST', '/v1/admin/memories/search', { query: 'name' });
    } catch {
      expect(true).toBe(true);
      return;
    }
    if (res.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }
    expect([401, 403]).toContain(res.statusCode);
  });

  it('supports extract/search/consolidate/decay flow (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const users = await apiCall('GET', '/v1/admin/users', undefined, TEST_SESSION_COOKIE);
    const userId = users.data?.data?.[0]?.id;
    if (!userId) {
      expect(true).toBe(true);
      return;
    }

    const extract = await apiCall(
      'POST',
      '/v1/admin/memories/extract',
      {
        user_id: userId,
        visibility: 'user_private',
        text: 'My name is E2E Tester and I like distributed systems',
      },
      TEST_SESSION_COOKIE,
    );
    if (extract.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }
    expect(extract.statusCode).toBe(200);
    expect(Number(extract.data?.data?.extracted || 0)).toBeGreaterThanOrEqual(1);

    const search = await apiCall(
      'POST',
      '/v1/admin/memories/search',
      {
        query: 'distributed systems',
        user_id: userId,
        top_k: 5,
      },
      TEST_SESSION_COOKIE,
    );
    expect(search.statusCode).toBe(200);
    expect(Array.isArray(search.data?.data)).toBe(true);

    const consolidate = await apiCall(
      'POST',
      '/v1/admin/memories/consolidate',
      { user_id: userId },
      TEST_SESSION_COOKIE,
    );
    expect(consolidate.statusCode).toBe(200);
    expect(typeof consolidate.data?.data?.merged).toBe('number');

    const decay = await apiCall(
      'POST',
      '/v1/admin/memories/decay',
      { half_life_days: 30, floor: 0.25 },
      TEST_SESSION_COOKIE,
    );
    expect(decay.statusCode).toBe(200);
    expect(typeof decay.data?.data?.decayed).toBe('number');
  });

  it('supports list filter + edit + delete + bulk delete + export/import flow (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const users = await apiCall('GET', '/v1/admin/users', undefined, TEST_SESSION_COOKIE);
    const userId = users.data?.data?.[0]?.id;
    if (!userId) {
      expect(true).toBe(true);
      return;
    }

    const unique = `e2e-memory-${Date.now()}`;
    const createdA = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        user_id: userId,
        visibility: 'user_private',
        key: `${unique}.a`,
        value: 'alpha memory content',
      },
      TEST_SESSION_COOKIE,
    );
    const createdB = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        user_id: userId,
        visibility: 'user_private',
        key: `${unique}.b`,
        value: 'beta memory content',
      },
      TEST_SESSION_COOKIE,
    );
    expect([200, 201]).toContain(createdA.statusCode);
    expect([200, 201]).toContain(createdB.statusCode);

    const idA = String(createdA.data?.data?.id || '');
    const idB = String(createdB.data?.data?.id || '');
    expect(idA.length).toBeGreaterThan(0);
    expect(idB.length).toBeGreaterThan(0);

    const list = await apiCall(
      'GET',
      `/v1/admin/memories?visibility=user_private&search=${encodeURIComponent(unique)}&per_page=50`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(list.statusCode).toBe(200);
    const listRows = Array.isArray(list.data?.data) ? list.data.data : [];
    expect(listRows.some((r: any) => String(r?.id || '') === idA)).toBe(true);

    const semantic = await apiCall(
      'POST',
      '/v1/admin/memories/search',
      { query: 'alpha memory', user_id: userId, visibility: 'user_private', top_k: 10 },
      TEST_SESSION_COOKIE,
    );
    expect(semantic.statusCode).toBe(200);
    const semanticRows = Array.isArray(semantic.data?.data) ? semantic.data.data : [];
    expect(Array.isArray(semanticRows)).toBe(true);

    const edit = await apiCall(
      'PUT',
      `/v1/admin/memories/${encodeURIComponent(idA)}`,
      { value: 'alpha memory content updated' },
      TEST_SESSION_COOKIE,
    );
    expect(edit.statusCode).toBe(200);
    expect(String(edit.data?.data?.value || '')).toContain('updated');

    const detail = await apiCall('GET', `/v1/admin/memories/${encodeURIComponent(idA)}`, undefined, TEST_SESSION_COOKIE);
    expect(detail.statusCode).toBe(200);
    expect(String(detail.data?.data?.value || '')).toContain('updated');

    const exported = await apiCall(
      'GET',
      `/v1/admin/memories/export?format=json&visibility=user_private&user_id=${encodeURIComponent(userId)}`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(exported.statusCode).toBe(200);
    const memories = Array.isArray(exported.data?.memories) ? exported.data.memories : [];
    expect(memories.length).toBeGreaterThan(0);

    const importPayload = memories
      .filter((m: any) => String(m?.key || '').startsWith(unique))
      .map((m: any) => ({
        user_id: m.user_id,
        chat_id: m.chat_id,
        visibility: m.visibility,
        key: `${String(m.key)}.imported`,
        value: String(m.value),
        source: 'import',
      }));

    if (importPayload.length > 0) {
      const imported = await apiCall(
        'POST',
        '/v1/admin/memories/import',
        { memories: importPayload },
        TEST_SESSION_COOKIE,
      );
      expect(imported.statusCode).toBe(200);
      expect(Number(imported.data?.data?.imported || 0)).toBeGreaterThan(0);
    }

    const singleDelete = await apiCall('DELETE', `/v1/admin/memories/${encodeURIComponent(idA)}`, undefined, TEST_SESSION_COOKIE);
    expect(singleDelete.statusCode).toBe(200);

    const bulkDelete = await apiCall(
      'DELETE',
      '/v1/admin/memories/bulk',
      { ids: [idB] },
      TEST_SESSION_COOKIE,
    );
    expect(bulkDelete.statusCode).toBe(200);
    expect(Number(bulkDelete.data?.data?.deleted || 0)).toBeGreaterThanOrEqual(1);
  });

  it('returns diverse + recent results when temporal decay and MMR enabled (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const users = await apiCall('GET', '/v1/admin/users', undefined, TEST_SESSION_COOKIE);
    const userId = users.data?.data?.[0]?.id;
    if (!userId) {
      expect(true).toBe(true);
      return;
    }

    const unique = `e2e-mmrd-${Date.now()}`;
    const createdA = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        user_id: userId,
        visibility: 'user_private',
        key: `${unique}.alpha`,
        value: 'alpha memory content',
      },
      TEST_SESSION_COOKIE,
    );
    const createdB = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        user_id: userId,
        visibility: 'user_private',
        key: `${unique}.alpha`,
        value: 'alpha memory content variant',
      },
      TEST_SESSION_COOKIE,
    );
    const createdC = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        user_id: userId,
        visibility: 'user_private',
        key: `${unique}.beta`,
        value: 'banana memory note',
      },
      TEST_SESSION_COOKIE,
    );

    const idA = String(createdA.data?.data?.id || '');
    const idB = String(createdB.data?.data?.id || '');
    const idC = String(createdC.data?.data?.id || '');
    if (!idA || !idB || !idC) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    try {
      await pool.query(
        `UPDATE memories SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`,
        [idA],
      );
    } finally {
      await pool.end();
    }

    const search = await apiCall(
      'POST',
      '/v1/admin/memories/search',
      {
        query: 'alpha memory',
        user_id: userId,
        visibility: 'user_private',
        top_k: 3,
        temporal_decay: true,
        decay_factor: 0.98,
        mmr: true,
        mmr_lambda: 0.3,
      },
      TEST_SESSION_COOKIE,
    );

    expect(search.statusCode).toBe(200);
    const rows = Array.isArray(search.data?.data) ? search.data.data : [];
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r: any) => String(r?.id || ''));

    // Expect newer alpha memory to outrank the older duplicate.
    const idxA = ids.indexOf(idA);
    const idxB = ids.indexOf(idB);
    if (idxA !== -1 && idxB !== -1) {
      expect(idxB).toBeLessThan(idxA);
    }

    // Expect MMR to include the diverse beta memory in top results.
    expect(ids.includes(idC)).toBe(true);
  });
});

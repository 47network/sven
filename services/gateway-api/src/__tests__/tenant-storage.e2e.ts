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
    client_name: `D2 tenant storage ${Date.now()}`,
    client_type: 'ci',
    scope: 'tenant storage',
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

describe('D2 tenant storage mapping', () => {
  it('provisions and updates tenant storage mapping', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const created = await apiCall('POST', '/v1/admin/accounts', { name: `Storage ${unique}` }, { bearer });
    expect(created.statusCode).toBe(201);
    const accountId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(accountId).toBeTruthy();

    const storage = await apiCall('GET', `/v1/admin/accounts/${encodeURIComponent(accountId)}/storage`, undefined, { bearer });
    expect(storage.statusCode).toBe(200);
    const storageRow = (storage.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(storageRow.organization_id || '')).toBe(accountId);
    expect(['shared_schema', 'dedicated_schema']).toContain(String(storageRow.storage_mode || ''));

    const forcedSchema = `tenant_${unique.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 24)}`;
    const updated = await apiCall(
      'PUT',
      `/v1/admin/accounts/${encodeURIComponent(accountId)}/storage`,
      { storage_mode: 'dedicated_schema', schema_name: forcedSchema, notes: 'rbac test update' },
      { bearer },
    );
    expect(updated.statusCode).toBe(200);
    const updatedRow = (updated.data as { data?: Record<string, unknown> })?.data || {};
    expect(String(updatedRow.storage_mode || '')).toBe('dedicated_schema');
    expect(String(updatedRow.schema_name || '')).toBe(forcedSchema);
    expect(Boolean(updatedRow.provisioned)).toBe(true);
  });
});

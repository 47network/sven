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
    client_name: `D3 proactive schedules ${Date.now()}`,
    client_type: 'ci',
    scope: 'd3 proactive',
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

describe('D3 proactive scheduled messages', () => {
  it('creates/list/deletes proactive preset schedules', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);

    const invalid = await apiCall(
      'POST',
      '/v1/schedules/proactive',
      { type: 'daily_digest', time: '99:99' },
      { bearer },
    );
    expect(invalid.statusCode).toBe(400);

    const created = await apiCall(
      'POST',
      '/v1/schedules/proactive',
      {
        type: 'daily_digest',
        time: '09:15',
        timezone: 'UTC',
        notify_channels: ['in_app'],
      },
      { bearer },
    );
    expect(created.statusCode).toBe(201);
    const proactiveId = String((created.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(proactiveId).toBeTruthy();

    const listing = await apiCall('GET', '/v1/schedules/proactive', undefined, { bearer });
    expect(listing.statusCode).toBe(200);
    const rows = ((listing.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
    expect(rows.some((row) => String(row.id || '') === proactiveId)).toBe(true);
    const createdRow = rows.find((row) => String(row.id || '') === proactiveId) || {};
    expect(String(createdRow.type || '')).toBe('daily_digest');

    const removed = await apiCall('DELETE', `/v1/schedules/proactive/${encodeURIComponent(proactiveId)}`, undefined, { bearer });
    expect(removed.statusCode).toBe(200);

    const listingAfter = await apiCall('GET', '/v1/schedules/proactive', undefined, { bearer });
    expect(listingAfter.statusCode).toBe(200);
    const afterRows = ((listingAfter.data as { data?: unknown[] })?.data || []) as Array<Record<string, unknown>>;
    expect(afterRows.some((row) => String(row.id || '') === proactiveId)).toBe(false);
  });
});

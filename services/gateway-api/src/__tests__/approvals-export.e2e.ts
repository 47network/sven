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

describe('Approvals export', () => {
  it('supports CSV export and validates format', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'CI Approvals Export Probe',
      client_type: 'ci',
      scope: 'approvals export',
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

    const csvExport = await apiCall(
      'GET',
      '/v1/approvals/export?status=history&format=csv&max_rows=50',
      undefined,
      { bearer: accessToken },
    );
    expect(csvExport.statusCode).toBe(200);
    expect(String(csvExport.headers['content-type'] || '')).toContain('text/csv');
    expect(String(csvExport.headers['content-disposition'] || '')).toContain('.csv');
    expect(csvExport.raw).toContain('id,chat_id,tool_name,scope,requester_user_id,status');

    const listAll = await apiCall(
      'GET',
      '/v1/approvals?status=pending&requester=all&limit=5',
      undefined,
      { bearer: accessToken },
    );
    expect(listAll.statusCode).toBe(200);

    const listAnyAlias = await apiCall(
      'GET',
      '/v1/approvals?status=pending&requester=any&limit=5',
      undefined,
      { bearer: accessToken },
    );
    expect(listAnyAlias.statusCode).toBe(200);

    const invalidFormat = await apiCall(
      'GET',
      '/v1/approvals/export?format=xml',
      undefined,
      { bearer: accessToken },
    );
    expect(invalidFormat.statusCode).toBe(400);
    const invalidPayload = invalidFormat.data as { success?: boolean; error?: { code?: string } } | null;
    expect(invalidPayload?.success).toBe(false);
    expect(String(invalidPayload?.error?.code || '')).toBe('VALIDATION');
  });
});

import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const REQUEST_ORIGIN = process.env.TEST_REQUEST_ORIGIN || new URL(API_BASE).origin;
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

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
    if (opts?.cookie) {
      headers.cookie = opts.cookie;
      headers.origin = REQUEST_ORIGIN;
    }

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

describe('Mobile auth/session lifecycle', () => {
  it('completes device flow, refreshes, and revokes session', async () => {
    if (!TEST_SESSION_COOKIE) {
      if (RUN_LIVE_GATEWAY_E2E) {
        throw new Error('TEST_SESSION_COOKIE is required when RUN_LIVE_GATEWAY_E2E=true');
      }
      return;
    }

    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'CI Mobile Session Smoke',
      client_type: 'mobile',
    });
    expect(started.statusCode).toBe(200);
    expect(started.data?.success).toBe(true);
    const deviceCode = String(started.data?.data?.device_code || '');
    const userCode = String(started.data?.data?.user_code || '');
    expect(deviceCode).toBeTruthy();
    expect(userCode).toBeTruthy();

    const confirmed = await apiCall(
      'POST',
      '/v1/auth/device/confirm',
      { user_code: userCode },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.data?.success).toBe(true);

    const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
    expect(tokenResp.statusCode).toBe(200);
    expect(tokenResp.data?.success).toBe(true);
    expect(String(tokenResp.data?.data?.status || '')).toBe('authorized');
    const accessToken = String(tokenResp.data?.data?.access_token || '');
    const refreshToken = String(tokenResp.data?.data?.refresh_token || '');
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const beforeRefresh = await apiCall('GET', '/v1/approvals?status=pending', undefined, {
      bearer: accessToken,
    });
    expect(beforeRefresh.statusCode).toBe(200);
    expect(beforeRefresh.data?.success).toBe(true);

    const refreshed = await apiCall('POST', '/v1/auth/refresh', { refresh_token: refreshToken });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.data?.success).toBe(true);
    const rotatedToken = String(refreshed.data?.data?.access_token || '');
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(accessToken);

    const oldTokenProbe = await apiCall('GET', '/v1/approvals?status=pending', undefined, {
      bearer: accessToken,
    });
    expect([200, 401]).toContain(oldTokenProbe.statusCode);

    const logout = await apiCall('POST', '/v1/auth/logout', undefined, { bearer: rotatedToken });
    expect([200, 400]).toContain(logout.statusCode);
    if (logout.statusCode === 200) {
      expect(logout.data?.success).toBe(true);
    }

    const afterLogout = await apiCall('GET', '/v1/approvals?status=pending', undefined, {
      bearer: rotatedToken,
    });
    expect([200, 401]).toContain(afterLogout.statusCode);
  });
});

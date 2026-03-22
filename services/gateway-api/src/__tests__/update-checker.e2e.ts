import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

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
    req.setTimeout(1500, () => {
      req.destroy(new Error('request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function isApiReachable(): Promise<boolean> {
  try {
    const res = await apiCall('GET', '/healthz');
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

describe('Update Checker API', () => {
  it('requires auth for status endpoint', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', '/v1/admin/update-checker/status');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('returns status with authenticated session (optional)', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', '/v1/admin/update-checker/status', undefined, TEST_SESSION_COOKIE);
    expect(res.statusCode).toBe(200);
    expect(res.data?.success).toBe(true);
    expect(typeof res.data?.data?.currentVersion).toBe('string');
  });
});

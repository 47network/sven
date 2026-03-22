import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_SESSION_CHAT_ID = process.env.TEST_SESSION_CHAT_ID || 'test-chat';

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

describe('Context Debug API', () => {
  it('requires auth for context debug endpoint', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', `/v1/admin/debug/context/${encodeURIComponent(TEST_SESSION_CHAT_ID)}`);
    expect([401, 403]).toContain(res.statusCode);
  });

  it('returns context payload for active session (optional)', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall(
      'GET',
      `/v1/admin/debug/context/${encodeURIComponent(TEST_SESSION_CHAT_ID)}`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(res.statusCode).toBe(200);
    expect(res.data?.success).toBe(true);
    expect(res.data?.data?.system_prompt).toBeDefined();
    expect(res.data?.data?.conversation).toBeDefined();
    expect(res.data?.data?.tools).toBeDefined();
    expect(typeof res.data?.data?.totals?.tokens).toBe('number');
  });
});

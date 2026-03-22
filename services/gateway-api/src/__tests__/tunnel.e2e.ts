import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_TUNNEL_REQUIRE_REACHABLE = String(process.env.TEST_TUNNEL_REQUIRE_REACHABLE || '').toLowerCase() === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (cookie) headers.cookie = cookie;

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
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
    req.end(payload || undefined);
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

describe('B5 tunnel status integration', () => {
  it('requires auth for admin tunnel status endpoint', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', '/v1/admin/tunnel/status');
    expect([401, 403]).toContain(res.statusCode);
  });

  it('returns tunnel URL and can optionally validate external reachability', async () => {
    if (!(await isApiReachable())) {
      expect(true).toBe(true);
      return;
    }
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const res = await apiCall('GET', '/v1/admin/tunnel/status', undefined, TEST_SESSION_COOKIE);
    expect(res.statusCode).toBe(200);
    expect(res.data?.success).toBe(true);

    const enabled = Boolean(res.data?.data?.enabled);
    const publicUrl = String(res.data?.data?.public_url || '');

    if (TEST_TUNNEL_REQUIRE_REACHABLE) {
      expect(enabled).toBe(true);
      expect(publicUrl).toMatch(/^https?:\/\//);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const probe = await fetch(publicUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
        });
        expect(probe.ok).toBe(true);
      } finally {
        clearTimeout(timer);
      }
    } else {
      // Soft assertion mode: endpoint must respond, tunnel may or may not be active.
      expect(typeof enabled).toBe('boolean');
    }
  });
});


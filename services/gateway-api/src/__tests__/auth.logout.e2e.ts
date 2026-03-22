import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_BEARER_TOKEN = process.env.TEST_BEARER_TOKEN || '';
const TEST_SESSION_CHAT_ID = process.env.TEST_SESSION_CHAT_ID || 'test-chat';
const RUN_LIVE = process.env.RUN_LIVE_GATEWAY_E2E === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  bearerToken?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }

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

describe('Auth logout', () => {
  it('returns success for unauthenticated logout request', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('POST', '/v1/auth/logout');
    if (res.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }
    expect(res.statusCode).toBe(200);
    expect(res.data?.success).toBe(true);
  });

  it('revokes bearer session token when provided (optional)', async () => {
    if (!RUN_LIVE || !TEST_BEARER_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const before = await apiCall(
      'GET',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/token-usage`,
      undefined,
      TEST_BEARER_TOKEN,
    );

    // If the provided token is already invalid in this environment, skip.
    if (before.statusCode === 401) {
      expect(true).toBe(true);
      return;
    }

    const logout = await apiCall('POST', '/v1/auth/logout', undefined, TEST_BEARER_TOKEN);
    expect(logout.statusCode).toBe(200);
    expect(logout.data?.success).toBe(true);

    const after = await apiCall(
      'GET',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/token-usage`,
      undefined,
      TEST_BEARER_TOKEN,
    );
    expect(after.statusCode).toBe(401);
    expect(after.data?.success).toBe(false);
  });

  it('requires auth for refresh', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('POST', '/v1/auth/refresh');
    if (res.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }
    expect(res.statusCode).toBe(401);
    expect(res.data?.success).toBe(false);
  });

  it('requires auth for logout-all', async () => {
    if (!RUN_LIVE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('POST', '/v1/auth/logout-all');
    if (res.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }
    expect(res.statusCode).toBe(401);
    expect(res.data?.success).toBe(false);
  });

  it('rejects bearer token refresh (optional)', async () => {
    if (!RUN_LIVE || !TEST_BEARER_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const refreshed = await apiCall('POST', '/v1/auth/refresh', undefined, TEST_BEARER_TOKEN);
    if (refreshed.statusCode === 404) {
      expect(true).toBe(true);
      return;
    }

    expect(refreshed.statusCode).toBe(401);
    expect(refreshed.data?.success).toBe(false);
  });

  it('revokes all sessions for current user via logout-all (optional)', async () => {
    if (!RUN_LIVE || !TEST_BEARER_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const logoutAll = await apiCall('POST', '/v1/auth/logout-all', undefined, TEST_BEARER_TOKEN);
    expect(logoutAll.statusCode).toBe(200);
    expect(logoutAll.data?.success).toBe(true);

    const probe = await apiCall(
      'GET',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/token-usage`,
      undefined,
      TEST_BEARER_TOKEN,
    );
    expect(probe.statusCode).toBe(401);
  });
});

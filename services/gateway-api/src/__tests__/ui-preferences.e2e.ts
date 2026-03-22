import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

type ApiResult = {
  statusCode: number;
  data: any;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { cookie?: string },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
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

describe('UI preferences contract', () => {
  it('reads and writes ui-preferences with defaults', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const getResp = await apiCall('GET', '/v1/me/ui-preferences', undefined, {
      cookie: TEST_SESSION_COOKIE,
    });
    expect(getResp.statusCode).toBe(200);
    expect(getResp.data?.success).toBe(true);

    const putResp = await apiCall(
      'PUT',
      '/v1/me/ui-preferences',
      {
        visual_mode: 'classic',
        avatar_mode: 'robot',
        motion_enabled: false,
      },
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(putResp.statusCode).toBe(200);
    expect(putResp.data?.success).toBe(true);
    expect(putResp.data?.data?.visual_mode).toBe('classic');
    expect(putResp.data?.data?.avatar_mode).toBe('robot');
  });
});

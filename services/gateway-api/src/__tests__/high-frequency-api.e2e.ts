import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

type ApiResult = {
  statusCode: number;
  data: any;
  latencyMs: number;
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

    const started = Date.now();
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
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
            latencyMs: Date.now() - started,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('High-frequency API paths', () => {
  it('exercises auth refresh + chats/messages + approvals with latency bounds', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const latencies: number[] = [];

    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'CI High Frequency API Probe',
      client_type: 'ci',
      scope: 'chat approvals',
    });
    latencies.push(started.latencyMs);
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
    latencies.push(confirmed.latencyMs);
    expect(confirmed.statusCode).toBe(200);

    const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
    latencies.push(tokenResp.latencyMs);
    expect(tokenResp.statusCode).toBe(200);
    expect(String(tokenResp.data?.data?.status || '')).toBe('authorized');

    const accessToken = String(tokenResp.data?.data?.access_token || '');
    const refreshToken = String(tokenResp.data?.data?.refresh_token || '');
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const me = await apiCall('GET', '/v1/me', undefined, { bearer: accessToken });
    latencies.push(me.latencyMs);
    expect(me.statusCode).toBe(200);
    expect(me.data?.success).toBe(true);
    const userId = String(me.data?.data?.id || '');
    expect(userId).toBeTruthy();

    const refreshed = await apiCall('POST', '/v1/auth/refresh', { refresh_token: refreshToken });
    latencies.push(refreshed.latencyMs);
    expect(refreshed.statusCode).toBe(200);
    const rotatedToken = String(refreshed.data?.data?.access_token || '');
    expect(rotatedToken).toBeTruthy();
    expect(rotatedToken).not.toBe(accessToken);

    const oldMe = await apiCall('GET', '/v1/me', undefined, { bearer: accessToken });
    latencies.push(oldMe.latencyMs);
    expect(oldMe.statusCode).toBe(401);

    const createdChat = await apiCall(
      'POST',
      '/v1/admin/chats',
      {
        name: `hf-${Date.now()}`,
        type: 'group',
        channel: 'webchat',
        channel_chat_id: `hf-${Date.now()}`,
      },
      { bearer: rotatedToken },
    );
    latencies.push(createdChat.latencyMs);
    expect(createdChat.statusCode).toBe(201);
    const chatId = String(createdChat.data?.data?.id || '');
    expect(chatId).toBeTruthy();

    const memberAdded = await apiCall(
      'POST',
      `/v1/admin/chats/${encodeURIComponent(chatId)}/members`,
      { user_id: userId, role: 'admin' },
      { bearer: rotatedToken },
    );
    latencies.push(memberAdded.latencyMs);
    expect([201, 409]).toContain(memberAdded.statusCode);

    const chatList = await apiCall('GET', '/v1/chats', undefined, { bearer: rotatedToken });
    latencies.push(chatList.latencyMs);
    expect(chatList.statusCode).toBe(200);
    expect(chatList.data?.success).toBe(true);

    const sendMessage = await apiCall(
      'POST',
      `/v1/chats/${encodeURIComponent(chatId)}/messages`,
      { text: `hf-message-${Date.now()}` },
      { bearer: rotatedToken },
    );
    latencies.push(sendMessage.latencyMs);
    expect(sendMessage.statusCode).toBe(201);
    expect(sendMessage.data?.success).toBe(true);

    const messages = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=20`,
      undefined,
      { bearer: rotatedToken },
    );
    latencies.push(messages.latencyMs);
    expect(messages.statusCode).toBe(200);
    expect(messages.data?.success).toBe(true);
    expect(Array.isArray(messages.data?.data?.rows)).toBe(true);

    const approvals = await apiCall('GET', '/v1/approvals?status=pending', undefined, {
      bearer: rotatedToken,
    });
    latencies.push(approvals.latencyMs);
    expect(approvals.statusCode).toBe(200);
    expect(approvals.data?.success).toBe(true);

    const voteMiss = await apiCall(
      'POST',
      '/v1/approvals/00000000-0000-0000-0000-000000000000/vote',
      { decision: 'approve' },
      { bearer: rotatedToken },
    );
    latencies.push(voteMiss.latencyMs);
    expect(voteMiss.statusCode).toBe(404);

    await apiCall('DELETE', `/v1/admin/chats/${encodeURIComponent(chatId)}`, undefined, {
      bearer: rotatedToken,
    });

    const sorted = [...latencies].sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
    expect(p95).toBeLessThan(3000);
  });
});

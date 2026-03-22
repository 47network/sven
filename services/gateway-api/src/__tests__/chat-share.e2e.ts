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

describe('Chat share contract', () => {
  it('validates expires_in_days and supports share lifecycle', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const started = await apiCall('POST', '/v1/auth/device/start', {
      client_name: 'CI Chat Share Probe',
      client_type: 'ci',
      scope: 'chat share',
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

    const me = await apiCall('GET', '/v1/me', undefined, { bearer: accessToken });
    expect(me.statusCode).toBe(200);
    const userId = String((me.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(userId).toBeTruthy();

    const unique = Date.now();
    const createdChat = await apiCall(
      'POST',
      '/v1/admin/chats',
      {
        name: `share-${unique}`,
        type: 'group',
        channel: 'webchat',
        channel_chat_id: `share-${unique}`,
      },
      { bearer: accessToken },
    );
    expect(createdChat.statusCode).toBe(201);
    const chatId = String((createdChat.data as { data?: { id?: unknown } })?.data?.id || '');
    expect(chatId).toBeTruthy();

    try {
      const memberAdded = await apiCall(
        'POST',
        `/v1/admin/chats/${encodeURIComponent(chatId)}/members`,
        { user_id: userId, role: 'admin' },
        { bearer: accessToken },
      );
      expect([201, 409]).toContain(memberAdded.statusCode);

      const invalidShare = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        { expires_in_days: -1 },
        { bearer: accessToken },
      );
      expect(invalidShare.statusCode).toBe(400);
      const invalidPayload = invalidShare.data as { success?: boolean; error?: { code?: string } } | null;
      expect(invalidPayload?.success).toBe(false);
      expect(String(invalidPayload?.error?.code || '')).toBe('VALIDATION');

      const invalidShareDecimal = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        { expires_in_days: 0.5 },
        { bearer: accessToken },
      );
      expect(invalidShareDecimal.statusCode).toBe(400);
      const invalidDecimalPayload = invalidShareDecimal.data as { success?: boolean; error?: { code?: string } } | null;
      expect(invalidDecimalPayload?.success).toBe(false);
      expect(String(invalidDecimalPayload?.error?.code || '')).toBe('VALIDATION');

      const share = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        { expires_in_days: 1 },
        { bearer: accessToken },
      );
      expect([200, 201]).toContain(share.statusCode);
      const shareToken = String((share.data as { data?: { share_token?: unknown } })?.data?.share_token || '');
      expect(shareToken).toBeTruthy();

      const shareAgain = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        { expires_in_days: 7 },
        { bearer: accessToken },
      );
      expect([200, 201]).toContain(shareAgain.statusCode);
      const shareAgainToken = String((shareAgain.data as { data?: { share_token?: unknown } })?.data?.share_token || '');
      expect(shareAgainToken).toBe(shareToken);

      const status = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        undefined,
        { bearer: accessToken },
      );
      expect(status.statusCode).toBe(200);
      const statusPayload = status.data as { data?: { active?: unknown } } | null;
      expect(Boolean(statusPayload?.data?.active)).toBe(true);

      const sharedRead = await apiCall(
        'GET',
        `/v1/shared/${encodeURIComponent(shareToken)}`,
      );
      expect(sharedRead.statusCode).toBe(200);
      const sharedPayload = sharedRead.data as { success?: boolean; data?: { messages?: unknown[] } } | null;
      expect(sharedPayload?.success).toBe(true);
      expect(Array.isArray(sharedPayload?.data?.messages)).toBe(true);

      const revoked = await apiCall(
        'DELETE',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        undefined,
        { bearer: accessToken },
      );
      expect(revoked.statusCode).toBe(200);

      const statusAfterRevoke = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        undefined,
        { bearer: accessToken },
      );
      expect(statusAfterRevoke.statusCode).toBe(200);
      const revokedStatusPayload = statusAfterRevoke.data as { data?: { active?: unknown } } | null;
      expect(Boolean(revokedStatusPayload?.data?.active)).toBe(false);

      const sharedAfterRevoke = await apiCall(
        'GET',
        `/v1/shared/${encodeURIComponent(shareToken)}`,
      );
      expect(sharedAfterRevoke.statusCode).toBe(404);

      const [raceCreateA, raceCreateB] = await Promise.all([
        apiCall(
          'POST',
          `/v1/chats/${encodeURIComponent(chatId)}/share`,
          { expires_in_days: 3 },
          { bearer: accessToken },
        ),
        apiCall(
          'POST',
          `/v1/chats/${encodeURIComponent(chatId)}/share`,
          { expires_in_days: 3 },
          { bearer: accessToken },
        ),
      ]);
      expect([200, 201]).toContain(raceCreateA.statusCode);
      expect([200, 201]).toContain(raceCreateB.statusCode);
      const raceTokenA = String((raceCreateA.data as { data?: { share_token?: unknown } })?.data?.share_token || '');
      const raceTokenB = String((raceCreateB.data as { data?: { share_token?: unknown } })?.data?.share_token || '');
      expect(raceTokenA).toBeTruthy();
      expect(raceTokenB).toBe(raceTokenA);
      expect(raceTokenA).not.toBe(shareToken);

      const finalStatus = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/share`,
        undefined,
        { bearer: accessToken },
      );
      expect(finalStatus.statusCode).toBe(200);
      const finalStatusPayload = finalStatus.data as { data?: { active?: unknown; share_token?: unknown } } | null;
      expect(Boolean(finalStatusPayload?.data?.active)).toBe(true);
      expect(String(finalStatusPayload?.data?.share_token || '')).toBe(raceTokenA);
    } finally {
      await apiCall('DELETE', `/v1/admin/chats/${encodeURIComponent(chatId)}`, undefined, {
        bearer: accessToken,
      });
    }
  });
});

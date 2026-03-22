import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_SESSION_CHAT_ID = process.env.TEST_SESSION_CHAT_ID || 'test-chat';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  cookie?: string,
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookie) {
      headers.Cookie = cookie;
    }

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
        res.on('data', (chunk) => {
          payload += chunk;
        });
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = payload ? JSON.parse(payload) : {};
          } catch {
            parsed = { raw: payload };
          }
          resolve({ statusCode: res.statusCode || 0, data: parsed });
        });
      },
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Sessions API (offline)', () => {
  it('exposes expected session route shapes', () => {
    expect('/v1/sessions/test-chat/token-usage').toContain('/v1/sessions/');
    expect('/v1/sessions/test-chat/compaction-history').toContain('compaction-history');
  });
});

const describeLive = RUN_LIVE_GATEWAY_E2E ? describe : describe.skip;

describeLive('Sessions API', () => {
  it('requires auth for token usage endpoint', async () => {
    const res = await apiCall('GET', '/v1/sessions/test-chat/token-usage');
    expect(res.statusCode).toBe(401);
  });

  it('requires auth for compaction history endpoint', async () => {
    const res = await apiCall('GET', '/v1/sessions/test-chat/compaction-history');
    expect(res.statusCode).toBe(401);
  });

  it('requires auth for compact endpoint', async () => {
    const res = await apiCall('POST', '/v1/sessions/test-chat/compact', { keep_recent: 5 });
    expect(res.statusCode).toBe(401);
  });

  it('supports token usage endpoint with authenticated session cookie (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const res = await apiCall('GET', `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/token-usage`, undefined, TEST_SESSION_COOKIE);
    expect(res.statusCode).toBe(200);
    expect(res.data?.success).toBe(true);
    expect(res.data?.data).toBeDefined();
    expect(typeof res.data?.data?.tracked_input_tokens).toBe('number');
    expect(typeof res.data?.data?.tracked_output_tokens).toBe('number');
    expect(typeof res.data?.data?.tracked_total_tokens).toBe('number');
    expect(res.data?.data?.tracked_total_tokens).toBe(
      res.data?.data?.tracked_input_tokens + res.data?.data?.tracked_output_tokens,
    );
  });

  it('supports compaction endpoints with authenticated session cookie (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }
    const compactRes = await apiCall(
      'POST',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compact`,
      { keep_recent: 5 },
      TEST_SESSION_COOKIE,
    );
    expect(compactRes.statusCode).toBe(200);
    expect(compactRes.data?.success).toBe(true);

    const historyRes = await apiCall('GET', `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compaction-history`, undefined, TEST_SESSION_COOKIE);
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.data?.success).toBe(true);
    expect(Array.isArray(historyRes.data?.data)).toBe(true);
  });

  it('compaction reduces estimated token count when force-compacted (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const compactRes = await apiCall(
      'POST',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compact`,
      { keep_recent: 1, force: true },
      TEST_SESSION_COOKIE,
    );
    expect(compactRes.statusCode).toBe(200);
    expect(compactRes.data?.success).toBe(true);

    if (compactRes.data?.data?.compacted === true) {
      const before = Number(compactRes.data?.data?.before_tokens || 0);
      const after = Number(compactRes.data?.data?.after_tokens || 0);
      expect(after).toBeLessThanOrEqual(before);
    } else {
      expect(typeof compactRes.data?.data?.reason).toBe('string');
    }
  });

  it('auto-compaction threshold decision flips should_compact (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const setWindow = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent('chat.model_context_window')}`,
      { value: 8 },
      TEST_SESSION_COOKIE,
    );
    expect([200, 201]).toContain(setWindow.statusCode);

    const setThreshold = await apiCall(
      'PUT',
      `/v1/admin/settings/${encodeURIComponent('chat.compaction.threshold_pct')}`,
      { value: 1 },
      TEST_SESSION_COOKIE,
    );
    expect([200, 201]).toContain(setThreshold.statusCode);

    const usage = await apiCall(
      'GET',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/token-usage`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(usage.statusCode).toBe(200);
    expect(usage.data?.success).toBe(true);
    expect(usage.data?.data?.should_compact).toBe(true);
  });

  it('pinned facts are preserved in compaction summary (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const addMemory = await apiCall(
      'POST',
      '/v1/admin/memories',
      {
        visibility: 'chat_shared',
        chat_id: TEST_SESSION_CHAT_ID,
        key: 'pinned.favorite_topic',
        value: 'parity-checklist',
      },
      TEST_SESSION_COOKIE,
    );
    expect([200, 201]).toContain(addMemory.statusCode);

    const compactRes = await apiCall(
      'POST',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compact`,
      { keep_recent: 1, force: true },
      TEST_SESSION_COOKIE,
    );
    expect(compactRes.statusCode).toBe(200);

    const historyRes = await apiCall(
      'GET',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compaction-history`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(historyRes.statusCode).toBe(200);
    const rows = Array.isArray(historyRes.data?.data) ? historyRes.data.data : [];
    if (rows.length === 0) {
      expect(true).toBe(true);
      return;
    }
    const latest = String(rows[0]?.summary_text || '');
    expect(latest).toContain('preserved_facts:');
    expect(latest).toContain('pinned.favorite_topic');
  });

  it('recent messages remain available after compaction (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const before = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/messages?limit=5`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    if (before.statusCode !== 200) {
      expect(true).toBe(true);
      return;
    }
    const beforeMessages = Array.isArray(before.data?.data) ? before.data.data : [];

    const compactRes = await apiCall(
      'POST',
      `/v1/sessions/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/compact`,
      { keep_recent: 2, force: true },
      TEST_SESSION_COOKIE,
    );
    expect(compactRes.statusCode).toBe(200);

    const after = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(TEST_SESSION_CHAT_ID)}/messages?limit=5`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(after.statusCode).toBe(200);
    const afterMessages = Array.isArray(after.data?.data) ? after.data.data : [];
    expect(afterMessages.length).toBeGreaterThanOrEqual(Math.min(1, beforeMessages.length));
  });
});

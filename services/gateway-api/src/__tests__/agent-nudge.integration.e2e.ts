import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const RUN_AGENT_NUDGE_RUNTIME_E2E =
  String(process.env.RUN_AGENT_NUDGE_RUNTIME_E2E || '').toLowerCase() === 'true';

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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAssistantCount(chatId: string): Promise<number> {
  const messages = await apiCall(
    'GET',
    `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=100`,
    undefined,
    TEST_SESSION_COOKIE,
  );
  const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
  return rows.filter((r: any) => String(r.role || '') === 'assistant').length;
}

describe('B14 Nudge Agent (integration)', () => {
  it('integration: nudge retries latest user turn and processing continues after resume (optional)', async () => {
    if (!RUN_AGENT_NUDGE_RUNTIME_E2E || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    let chatId = '';
    try {
      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `agent-nudge-${Date.now()}`, type: 'dm' },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const pause = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/pause`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(pause.statusCode).toBe(200);

      const send = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `nudge-me-${Date.now()}` },
        TEST_SESSION_COOKIE,
      );
      expect(send.statusCode).toBeGreaterThanOrEqual(200);
      expect(send.statusCode).toBeLessThan(300);

      await sleep(2000);
      const nudge = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/nudge`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(nudge.statusCode).toBe(200);
      expect(Boolean(nudge.data?.data?.nudged)).toBe(true);

      const resume = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/resume`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(resume.statusCode).toBe(200);

      let assistants = 0;
      for (let i = 0; i < 90; i += 1) {
        await sleep(1000);
        assistants = await getAssistantCount(chatId);
        if (assistants >= 1) break;
      }
      expect(assistants).toBeGreaterThanOrEqual(1);
    } finally {
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });

  it('integration: nudge endpoint records audit metadata and increments nonce (optional)', async () => {
    if (!RUN_AGENT_NUDGE_RUNTIME_E2E || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    let chatId = '';
    try {
      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `agent-nudge-nonce-${Date.now()}`, type: 'dm' },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const send = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `nonce-msg-${Date.now()}` },
        TEST_SESSION_COOKIE,
      );
      expect(send.statusCode).toBeGreaterThanOrEqual(200);
      expect(send.statusCode).toBeLessThan(300);

      const n1 = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/nudge`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(n1.statusCode).toBe(200);
      const nonce1 = Number(n1.data?.data?.nudge_nonce || 0);
      expect(nonce1).toBeGreaterThan(0);

      const n2 = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/nudge`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(n2.statusCode).toBe(200);
      const nonce2 = Number(n2.data?.data?.nudge_nonce || 0);
      expect(nonce2).toBeGreaterThan(nonce1);
    } finally {
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });
});


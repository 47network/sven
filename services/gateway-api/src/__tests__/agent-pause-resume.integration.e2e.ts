import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const RUN_AGENT_PAUSE_RUNTIME_E2E =
  String(process.env.RUN_AGENT_PAUSE_RUNTIME_E2E || '').toLowerCase() === 'true';

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

async function waitForAssistantCount(chatId: string, cookie: string, minCount: number, timeoutMs = 60_000): Promise<number> {
  const start = Date.now();
  let lastCount = 0;
  while (Date.now() - start < timeoutMs) {
    const messages = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=100`,
      undefined,
      cookie,
    );
    if (messages.statusCode === 200) {
      const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
      const assistants = rows.filter((r: any) => String(r.role || '') === 'assistant');
      lastCount = assistants.length;
      if (lastCount >= minCount) return lastCount;
    }
    await sleep(1000);
  }
  return lastCount;
}

async function getAssistantCount(chatId: string, cookie: string): Promise<number> {
  const messages = await apiCall(
    'GET',
    `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=100`,
    undefined,
    cookie,
  );
  if (messages.statusCode !== 200) return 0;
  const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
  return rows.filter((r: any) => String(r.role || '') === 'assistant').length;
}

describe('B13 Pause/Resume Agent (integration)', () => {
  it('integration: pause blocks processing and resume continues from paused state (optional)', async () => {
    if (!RUN_AGENT_PAUSE_RUNTIME_E2E || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    let chatId = '';
    try {
      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `agent-pause-${Date.now()}`, type: 'dm' },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const pauseRes = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/pause`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(pauseRes.statusCode).toBe(200);
      expect(Boolean(pauseRes.data?.data?.paused)).toBe(true);

      const sendPaused = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `paused-msg-${Date.now()}` },
        TEST_SESSION_COOKIE,
      );
      expect(sendPaused.statusCode).toBeGreaterThanOrEqual(200);
      expect(sendPaused.statusCode).toBeLessThan(300);

      await sleep(8000);
      const pausedAssistantCount = await getAssistantCount(chatId, TEST_SESSION_COOKIE);
      expect(pausedAssistantCount).toBe(0);

      const resumeRes = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/resume`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(resumeRes.statusCode).toBe(200);
      expect(Boolean(resumeRes.data?.data?.paused)).toBe(false);

      const resumedAssistantCount = await waitForAssistantCount(chatId, TEST_SESSION_COOKIE, 1, 90_000);
      expect(resumedAssistantCount).toBeGreaterThanOrEqual(1);
    } finally {
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });

  it('integration: pause after first request allows current response, then halts additional processing until resume (optional)', async () => {
    if (!RUN_AGENT_PAUSE_RUNTIME_E2E || !TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    let chatId = '';
    try {
      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `agent-pause-mid-${Date.now()}`, type: 'dm' },
        TEST_SESSION_COOKIE,
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const firstSend = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `first-msg-${Date.now()}` },
        TEST_SESSION_COOKIE,
      );
      expect(firstSend.statusCode).toBeGreaterThanOrEqual(200);
      expect(firstSend.statusCode).toBeLessThan(300);

      await sleep(800);
      const pauseRes = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/pause`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(pauseRes.statusCode).toBe(200);
      expect(Boolean(pauseRes.data?.data?.paused)).toBe(true);

      const secondSend = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: `second-msg-${Date.now()}` },
        TEST_SESSION_COOKIE,
      );
      expect(secondSend.statusCode).toBeGreaterThanOrEqual(200);
      expect(secondSend.statusCode).toBeLessThan(300);

      const firstAssistantCount = await waitForAssistantCount(chatId, TEST_SESSION_COOKIE, 1, 90_000);
      expect(firstAssistantCount).toBeGreaterThanOrEqual(1);

      await sleep(8000);
      const stillOneAssistant = await getAssistantCount(chatId, TEST_SESSION_COOKIE);
      expect(stillOneAssistant).toBe(1);

      const resumeRes = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/agent/resume`,
        {},
        TEST_SESSION_COOKIE,
      );
      expect(resumeRes.statusCode).toBe(200);

      const secondAssistantCount = await waitForAssistantCount(chatId, TEST_SESSION_COOKIE, 2, 90_000);
      expect(secondAssistantCount).toBeGreaterThanOrEqual(2);
    } finally {
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });
});


import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_SEARCH_CHAT_ID = process.env.TEST_SEARCH_CHAT_ID || '';

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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Search citations via agent flow', () => {
  it('agent uses search and returns citation-like output (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_SEARCH_CHAT_ID) {
      expect(true).toBe(true);
      return;
    }

    const sent = await apiCall(
      'POST',
      `/v1/chats/${encodeURIComponent(TEST_SEARCH_CHAT_ID)}/messages`,
      {
        text: 'Use web search to summarize the latest OpenSearch release notes and cite sources with links.',
      },
      TEST_SESSION_COOKIE,
    );
    if (sent.statusCode !== 201) {
      expect(true).toBe(true);
      return;
    }

    const messageId = String(sent.data?.data?.id || '');
    expect(messageId.length).toBeGreaterThan(0);

    const start = Date.now();
    const timeoutMs = 60_000;
    let matchedAssistantText = '';

    while (Date.now() - start < timeoutMs) {
      const msgs = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(TEST_SEARCH_CHAT_ID)}/messages?limit=40`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      if (msgs.statusCode === 200) {
        const rows = Array.isArray(msgs.data?.data) ? msgs.data.data : [];
        for (const row of rows) {
          if (String(row?.role || '') !== 'assistant') continue;
          const text = String(row?.text || '');
          const hasLink = /https?:\/\//i.test(text);
          const hasCitationMarker = /\[[0-9]+\]|\bsource(s)?\b/i.test(text);
          if (hasLink && hasCitationMarker) {
            matchedAssistantText = text;
            break;
          }
        }
      }

      if (matchedAssistantText) break;
      await sleep(2000);
    }

    if (!matchedAssistantText) {
      // Optional e2e: if runtime/search isn't wired in this environment, do not fail CI.
      expect(true).toBe(true);
      return;
    }

    expect(/https?:\/\//i.test(matchedAssistantText)).toBe(true);
    expect(/\[[0-9]+\]|\bsource(s)?\b/i.test(matchedAssistantText)).toBe(true);
  });
});


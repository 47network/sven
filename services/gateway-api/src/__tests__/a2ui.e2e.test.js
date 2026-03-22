import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_CHAT_ID = process.env.TEST_CHAT_ID || '';

async function apiCall(method, endpoint, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsed = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
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

function openA2uiStream(chatId, cookie, events) {
  const url = `${API_BASE}/v1/chats/${encodeURIComponent(chatId)}/a2ui/stream`;
  const parsed = new URL(url);
  const headers = {};
  if (cookie) headers.Cookie = cookie;

  const req = http.request(
    {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    },
    (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += String(chunk);
        const blocks = buffer.split('\n\n');
        while (blocks.length > 1) {
          const block = blocks.shift() || '';
          if (!block.includes('event:') || !block.includes('data:')) continue;
          const evType = ((block.match(/^event:\s*(.+)$/m) || [])[1] || '').trim();
          const dataRaw = ((block.match(/^data:\s*(.+)$/m) || [])[1] || '').trim();
          try {
            events.push({ type: evType, data: JSON.parse(dataRaw) });
          } catch {
            events.push({ type: evType, data: {} });
          }
        }
        buffer = blocks[0] || '';
      });
    },
  );
  req.end();
  return req;
}

describe('Live Canvas A2UI', () => {
  it('push -> stream update -> interaction event round-trip (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_CHAT_ID) {
      expect(true).toBe(true);
      return;
    }

    const seen = [];
    const sseReq = openA2uiStream(TEST_CHAT_ID, TEST_SESSION_COOKIE, seen);

    const pushed = await apiCall(
      'POST',
      `/v1/chats/${encodeURIComponent(TEST_CHAT_ID)}/a2ui/push`,
      {
        html: '<button data-a2ui-action="submit" data-a2ui-payload="{\"ok\":true}">Ship</button>',
        state: { count: 1 },
      },
      TEST_SESSION_COOKIE,
    );
    expect(pushed.statusCode).toBe(200);

    const interacted = await apiCall(
      'POST',
      `/v1/chats/${encodeURIComponent(TEST_CHAT_ID)}/a2ui/interaction`,
      { event_type: 'submit', payload: { ok: true } },
      TEST_SESSION_COOKIE,
    );
    expect(interacted.statusCode).toBe(201);

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (seen.some((e) => e.type === 'push') && seen.some((e) => e.type === 'interaction')) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    sseReq.destroy();
    expect(seen.some((e) => e.type === 'push')).toBe(true);
    expect(seen.some((e) => e.type === 'interaction')).toBe(true);
  });
});

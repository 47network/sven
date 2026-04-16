import http from 'http';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_ADAPTER_TOKEN = process.env.TEST_ADAPTER_TOKEN || '';
const TEST_CHANNEL = process.env.TEST_CHANNEL || '';
const TEST_CHAT_ID = process.env.TEST_CHAT_ID || '';
const TEST_SENDER_ID = process.env.TEST_SENDER_ID || '';

async function apiCall(method, endpoint, body, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (opts.cookie) headers.Cookie = opts.cookie;
    if (opts.adapterToken) headers['X-SVEN-ADAPTER-TOKEN'] = opts.adapterToken;

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

function hasEnv() {
  return Boolean(TEST_SESSION_COOKIE && TEST_ADAPTER_TOKEN && TEST_CHANNEL && TEST_CHAT_ID && TEST_SENDER_ID);
}

async function sendInbound(text) {
  const startedAt = Date.now();
  const res = await apiCall(
    'POST',
    '/v1/events/message',
    {
      channel: TEST_CHANNEL,
      channel_message_id: `chatcmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      chat_id: TEST_CHAT_ID,
      sender_identity_id: TEST_SENDER_ID,
      text,
      metadata: { source: 'chat-commands-e2e' },
    },
    { adapterToken: TEST_ADAPTER_TOKEN },
  );
  expect(res.statusCode).toBe(202);
  return startedAt;
}

async function waitForAssistantMessage(sinceMs, predicate) {
  const timeoutMs = 30000;
  const intervalMs = 1000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const res = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(TEST_CHAT_ID)}/messages?limit=100`,
      undefined,
      { cookie: TEST_SESSION_COOKIE },
    );
    if (res.statusCode === 200) {
      const rows = Array.isArray(res.data?.data?.rows) ? res.data.data.rows : [];
      const match = rows
        .filter((m) => m?.role === 'assistant' || m?.role === 'system')
        .reverse()
        .find((m) => {
          const createdAt = m?.created_at ? Date.parse(String(m.created_at)) : 0;
          if (!createdAt || createdAt < sinceMs - 1000) return false;
          return predicate(String(m?.text || ''));
        });
      if (match) return { text: String(match.text || ''), role: String(match.role || '') };
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

describe('Chat Commands E2E', () => {
  it('responds to /status with session info (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const since = await sendInbound('/status');
    const msg = await waitForAssistantMessage(
      since,
      (text) => text.includes('Session status:') && text.includes(`chat_id: ${TEST_CHAT_ID}`),
    );
    expect(msg).not.toBeNull();
  });

  it('creates reset marker on /reset (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const since = await sendInbound('/reset');
    const ack = await waitForAssistantMessage(since, (text) => text.includes('Session context reset.'));
    expect(ack).not.toBeNull();

    const msgs = await apiCall(
      'GET',
      `/v1/chats/${encodeURIComponent(TEST_CHAT_ID)}/messages?limit=100`,
      undefined,
      { cookie: TEST_SESSION_COOKIE },
    );
    expect(msgs.statusCode).toBe(200);
    const rows = Array.isArray(msgs.data?.data?.rows) ? msgs.data.data.rows : [];
    const marker = rows.find((m) => m?.role === 'system' && String(m?.text || '').includes('[SVEN_SESSION_RESET]'));
    expect(Boolean(marker)).toBe(true);
  });

  it('runs /compact and reports token change (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const since = await sendInbound('/compact');
    const msg = await waitForAssistantMessage(
      since,
      (text) => text.includes('Compaction complete.') || text.includes('Compaction skipped:'),
    );
    expect(msg).not.toBeNull();
    if (msg && msg.text.includes('Compaction complete.')) {
      const m = msg.text.match(/Estimated context tokens:\s*(\d+)\s*->\s*(\d+)/i);
      expect(m).not.toBeNull();
      if (m) {
        const before = Number(m[1]);
        const after = Number(m[2]);
        expect(after).toBeLessThanOrEqual(before);
      }
    }
  });

  it('applies /think high and confirms behavior setting (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const since = await sendInbound('/think high');
    const msg = await waitForAssistantMessage(since, (text) => text.includes('Thinking level set to high.'));
    expect(msg).not.toBeNull();
  });

  it('switches model with /model (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const modelName = 'test-model';
    const since = await sendInbound(`/model ${modelName}`);
    const msg = await waitForAssistantMessage(since, (text) => text.includes(`Model override set to ${modelName}.`));
    expect(msg).not.toBeNull();
  });

  it('returns command list on /help (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const since = await sendInbound('/help');
    const msg = await waitForAssistantMessage(
      since,
      (text) => text.includes('Available commands:') && text.includes('/status') && text.includes('/compact'),
    );
    expect(msg).not.toBeNull();
  });

  it('returns unknown command guidance (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const unknown = `/definitely_unknown_${Date.now()}`;
    const since = await sendInbound(unknown);
    const msg = await waitForAssistantMessage(since, (text) => text.includes('Unknown command') && text.includes('Use /help'));
    expect(msg).not.toBeNull();
  });
});

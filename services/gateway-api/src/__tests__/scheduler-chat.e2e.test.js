import http from 'http';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_ADAPTER_TOKEN = process.env.TEST_ADAPTER_TOKEN || '';
const TEST_CHANNEL = process.env.TEST_CHANNEL || '';
const TEST_CHAT_ID = process.env.TEST_CHAT_ID || '';
const TEST_SENDER_ID = process.env.TEST_SENDER_ID || '';
const ENABLE_CHAT_SCHEDULE_E2E = process.env.SCHEDULER_CHAT_E2E === '1';

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
  return Boolean(
    ENABLE_CHAT_SCHEDULE_E2E
      && TEST_SESSION_COOKIE
      && TEST_ADAPTER_TOKEN
      && TEST_CHANNEL
      && TEST_CHAT_ID
      && TEST_SENDER_ID,
  );
}

async function sendInbound(text) {
  const res = await apiCall(
    'POST',
    '/v1/events/message',
    {
      channel: TEST_CHANNEL,
      channel_message_id: `schedule-chat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      chat_id: TEST_CHAT_ID,
      sender_identity_id: TEST_SENDER_ID,
      text,
      metadata: { source: 'scheduler-chat-e2e' },
    },
    { adapterToken: TEST_ADAPTER_TOKEN },
  );
  expect(res.statusCode).toBe(202);
}

async function listSchedules() {
  const res = await apiCall(
    'GET',
    '/v1/schedules',
    undefined,
    { cookie: TEST_SESSION_COOKIE },
  );
  expect(res.statusCode).toBe(200);
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows;
}

async function waitForScheduleName(name, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await listSchedules();
    const match = rows.find((row) => String(row?.name || '') === name);
    if (match) return match;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

describe('Scheduler Chat E2E', () => {
  it('creates schedule via chat (optional)', async () => {
    if (!hasEnv()) return expect(true).toBe(true);
    const taskName = `Test: Chat schedule ${Date.now()}`;
    const text = `Please create a scheduled task. Use the schedule.create tool with: name \'${taskName}\', instruction \'Check inbox\', schedule_type \'recurring\', expression \'*/10 * * * *\'.`;

    await sendInbound(text);

    const match = await waitForScheduleName(taskName, 90000);
    expect(match).not.toBeNull();
  });
});

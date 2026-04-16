import http from 'http';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const EMAIL_PUSH_TEST_TOKEN = process.env.EMAIL_PUSH_TEST_TOKEN || '';

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

describe('Gmail Pub/Sub Email Triggers', () => {
  it('email push -> handler path is executed and logged (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !EMAIL_PUSH_TEST_TOKEN) {
      expect(true).toBe(true);
      return;
    }

    const subName = `projects/test/subscriptions/sven-${Date.now()}`;
    const created = await apiCall(
      'POST',
      '/v1/admin/email/subscriptions',
      {
        name: 'gmail-test',
        pubsub_subscription: subName,
        handler: 'nats_event',
        config: { subject: 'email.received.test' },
      },
      TEST_SESSION_COOKIE,
    );
    expect(created.statusCode).toBe(201);
    const subId = created.data?.data?.id;
    expect(typeof subId).toBe('string');

    const pubsubPayload = {
      emailAddress: 'demo@example.com',
      historyId: '12345',
      messageId: 'msg-1',
    };
    const push = await apiCall(
      'POST',
      `/v1/email/push?token=${encodeURIComponent(EMAIL_PUSH_TEST_TOKEN)}`,
      {
        subscription: subName,
        message: {
          messageId: 'pubsub-1',
          data: Buffer.from(JSON.stringify(pubsubPayload), 'utf8').toString('base64'),
        },
      },
      undefined,
    );
    expect(push.statusCode).toBe(200);
    expect(Number(push.data?.data?.processed || 0)).toBeGreaterThan(0);

    const events = await apiCall(
      'GET',
      `/v1/admin/email/subscriptions/${encodeURIComponent(subId)}/events?limit=20`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(events.statusCode).toBe(200);
    const rows = events.data?.data || [];
    expect(rows.some((r) => r.status === 'success')).toBe(true);
  });
});

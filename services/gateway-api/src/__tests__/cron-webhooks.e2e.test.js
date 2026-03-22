import http from 'http';
import crypto from 'crypto';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const TEST_RUN_LONG_CRON = process.env.TEST_RUN_LONG_CRON === '1';

async function apiCall(method, endpoint, body, cookie, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${endpoint}`;
    const parsedUrl = new URL(url);
    const requestHeaders = { 'Content-Type': 'application/json', ...headers };
    if (cookie) requestHeaders.Cookie = cookie;

    const req = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: requestHeaders,
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

describe('Cron & Webhooks Surface', () => {
  it('webhook signature verification passes/fails and execution is logged (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const path = `test-hook-${Date.now()}`;
    const secret = 'test-secret';
    const created = await apiCall(
      'POST',
      '/v1/admin/webhooks',
      {
        name: 'test',
        path,
        handler: 'nats_event',
        secret,
        config: { subject: 'notify.push' },
      },
      TEST_SESSION_COOKIE,
    );
    expect(created.statusCode).toBe(201);
    const webhookId = created.data?.data?.id;
    expect(typeof webhookId).toBe('string');

    const payload = { hello: 'world' };
    const bad = await apiCall('POST', `/v1/webhooks/${encodeURIComponent(path)}`, payload);
    expect(bad.statusCode).toBe(401);

    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const ok = await apiCall(
      'POST',
      `/v1/webhooks/${encodeURIComponent(path)}`,
      payload,
      undefined,
      { 'x-sven-signature': sig },
    );
    expect(ok.statusCode).toBe(200);

    const events = await apiCall(
      'GET',
      `/v1/admin/webhooks/${encodeURIComponent(webhookId)}/events?limit=20`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(events.statusCode).toBe(200);
    const rows = events.data?.data || [];
    expect(rows.some((r) => r.status === 'success')).toBe(true);
    expect(rows.some((r) => r.status === 'error')).toBe(true);
  });

  it('cron job can be created and executed through run endpoint (optional)', async () => {
    if (!TEST_SESSION_COOKIE) {
      expect(true).toBe(true);
      return;
    }

    const created = await apiCall(
      'POST',
      '/v1/admin/cron',
      {
        name: `test-cron-${Date.now()}`,
        expression: '*/5 * * * *',
        handler: 'health_check',
        payload: {},
      },
      TEST_SESSION_COOKIE,
    );
    expect(created.statusCode).toBe(201);
    const cronId = created.data?.data?.id;
    expect(typeof cronId).toBe('string');

    const runNow = await apiCall(
      'POST',
      `/v1/admin/cron/${encodeURIComponent(cronId)}/run`,
      {},
      TEST_SESSION_COOKIE,
    );
    expect(runNow.statusCode).toBe(200);

    const history = await apiCall(
      'GET',
      `/v1/admin/cron/${encodeURIComponent(cronId)}/history?limit=10`,
      undefined,
      TEST_SESSION_COOKIE,
    );
    expect(history.statusCode).toBe(200);
    const rows = history.data?.data || [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.status === 'success')).toBe(true);
  });

  it('cron job fires on schedule (optional,long)', async () => {
    if (!TEST_SESSION_COOKIE || !TEST_RUN_LONG_CRON) {
      expect(true).toBe(true);
      return;
    }

    const created = await apiCall(
      'POST',
      '/v1/admin/cron',
      {
        name: `test-cron-scheduled-${Date.now()}`,
        expression: '* * * * *',
        handler: 'health_check',
        payload: {},
      },
      TEST_SESSION_COOKIE,
    );
    expect(created.statusCode).toBe(201);
    const cronId = created.data?.data?.id;
    expect(typeof cronId).toBe('string');

    const deadline = Date.now() + 75_000;
    let fired = false;
    while (Date.now() < deadline) {
      const history = await apiCall(
        'GET',
        `/v1/admin/cron/${encodeURIComponent(cronId)}/history?limit=5`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      if (history.statusCode === 200) {
        const rows = history.data?.data || [];
        if (rows.some((r) => r.status === 'success')) {
          fired = true;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    expect(fired).toBe(true);
  });
});

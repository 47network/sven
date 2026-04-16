import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createHmac } from 'crypto';
import { describe, expect, it } from '@jest/globals';

const RUN = process.env.TEST_LINE_ADAPTER_E2E === '1';
const ADAPTER_ENTRY =
  process.env.LINE_ADAPTER_ENTRY ||
  path.resolve(process.cwd(), '../adapter-line/dist/index.js');
const ADAPTER_TOKEN = process.env.TEST_ADAPTER_TOKEN || 'test-adapter-token';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, timeoutMs = 15000, stepMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await sleep(stepMs);
  }
  return false;
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += String(c)));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function startAdapter(env) {
  return spawn('node', [ADAPTER_ENTRY], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
}

describe('LINE Adapter E2E (mocked)', () => {
  it('ingest webhook -> gateway event and outbox deliver (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(ADAPTER_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const seen = {
      gatewayMessageEvents: [],
      sentOutboxIds: [],
      linePushes: [],
    };
    const outboxQueue = [
      {
        id: 'ob-line-1',
        chat_id: 'chat-1',
        channel: 'line',
        channel_chat_id: 'UlineUser',
        content_type: 'text',
        text: 'hello from outbox',
      },
    ];

    const gateway = await startServer(async (req, res) => {
      if (req.headers['x-sven-adapter-token'] !== ADAPTER_TOKEN) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/identity/resolve') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { identity_id: 'ident-1', user_id: 'user-1' } }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/chat/resolve') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { chat_id: 'chat-1' } }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/chat/ensure-member') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/events/message') {
        const body = await readJsonBody(req);
        seen.gatewayMessageEvents.push(body);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { event_id: 'evt-line-1' } }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/outbox/next')) {
        const items = outboxQueue.splice(0, 1);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { items } }));
        return;
      }
      if (req.method === 'POST' && req.url.startsWith('/v1/outbox/') && req.url.endsWith('/sent')) {
        seen.sentOutboxIds.push(req.url.split('/')[3]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const lineApi = await startServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/v2/bot/message/push') {
        const body = await readJsonBody(req);
        seen.linePushes.push(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const adapterPort = 19088;
    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'line',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
      LINE_CHANNEL_SECRET: 'line-secret',
      LINE_API_BASE: lineApi.baseUrl,
      LINE_HOST: '127.0.0.1',
      LINE_PORT: String(adapterPort),
      OUTBOX_POLL_INTERVAL: '200',
    });

    try {
      await sleep(1200);
      const payload = {
        destination: 'dest',
        events: [
          {
            type: 'message',
            webhookEventId: 'wev-1',
            replyToken: 'reply-1',
            source: { type: 'user', userId: 'UlineUser' },
            message: { id: 'mid-1', type: 'text', text: 'hello from line' },
          },
        ],
      };
      const raw = JSON.stringify(payload);
      const sig = createHmac('sha256', 'line-secret').update(raw).digest('base64');
      await fetch(`http://127.0.0.1:${adapterPort}/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-line-signature': sig,
        },
        body: raw,
      });

      const ok = await waitFor(
        () =>
          seen.gatewayMessageEvents.length > 0 &&
          seen.linePushes.length > 0 &&
          seen.sentOutboxIds.includes('ob-line-1'),
        15000,
      );

      expect(ok).toBe(true);
      expect(seen.gatewayMessageEvents[0].text).toBe('hello from line');
      expect(seen.linePushes[0].messages[0].text).toContain('hello from outbox');
    } finally {
      adapter.kill('SIGTERM');
      await gateway.close();
      await lineApi.close();
    }
  }, 30000);

  it('accepts valid signature computed over exact raw webhook bytes (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(ADAPTER_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const seen = {
      gatewayMessageEvents: [],
    };

    const gateway = await startServer(async (req, res) => {
      if (req.headers['x-sven-adapter-token'] !== ADAPTER_TOKEN) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/identity/resolve') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { identity_id: 'ident-2', user_id: 'user-2' } }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/chat/resolve') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { chat_id: 'chat-2' } }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/adapter/chat/ensure-member') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/events/message') {
        const body = await readJsonBody(req);
        seen.gatewayMessageEvents.push(body);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { event_id: 'evt-line-2' } }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/outbox/next')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { items: [] } }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const lineApi = await startServer(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    });

    const adapterPort = 19089;
    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'line',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
      LINE_CHANNEL_SECRET: 'line-secret',
      LINE_API_BASE: lineApi.baseUrl,
      LINE_HOST: '127.0.0.1',
      LINE_PORT: String(adapterPort),
      OUTBOX_POLL_INTERVAL: '200',
    });

    try {
      await sleep(1200);
      const raw = `{
  "destination": "dest",
  "events": [
    {
      "type": "message",
      "webhookEventId": "wev-2",
      "replyToken": "reply-2",
      "source": { "type": "user", "userId": "UlineUser" },
      "message": { "id": "mid-2", "type": "text", "text": "raw-body-signed" }
    }
  ]
}`;
      const sig = createHmac('sha256', 'line-secret').update(raw).digest('base64');
      const res = await fetch(`http://127.0.0.1:${adapterPort}/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-line-signature': sig,
        },
        body: raw,
      });

      expect(res.status).toBe(200);
      const ok = await waitFor(() => seen.gatewayMessageEvents.length > 0, 10000);
      expect(ok).toBe(true);
      expect(seen.gatewayMessageEvents[0].text).toBe('raw-body-signed');
    } finally {
      adapter.kill('SIGTERM');
      await gateway.close();
      await lineApi.close();
    }
  }, 30000);

  it('rejects signature computed from re-serialized payload instead of raw bytes (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(ADAPTER_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const gateway = await startServer(async (req, res) => {
      if (req.headers['x-sven-adapter-token'] !== ADAPTER_TOKEN) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/outbox/next')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { items: [] } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });

    const lineApi = await startServer(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    });

    const adapterPort = 19090;
    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'line',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
      LINE_CHANNEL_SECRET: 'line-secret',
      LINE_API_BASE: lineApi.baseUrl,
      LINE_HOST: '127.0.0.1',
      LINE_PORT: String(adapterPort),
      OUTBOX_POLL_INTERVAL: '200',
    });

    try {
      await sleep(1200);
      const raw = `{
  "destination": "dest",
  "events": [
    {
      "type": "message",
      "webhookEventId": "wev-3",
      "replyToken": "reply-3",
      "source": { "type": "user", "userId": "UlineUser" },
      "message": { "id": "mid-3", "type": "text", "text": "tamper-check" }
    }
  ]
}`;
      const wrongSig = createHmac('sha256', 'line-secret')
        .update(JSON.stringify(JSON.parse(raw)))
        .digest('base64');
      const res = await fetch(`http://127.0.0.1:${adapterPort}/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-line-signature': wrongSig,
        },
        body: raw,
      });

      expect(res.status).toBe(401);
    } finally {
      adapter.kill('SIGTERM');
      await gateway.close();
      await lineApi.close();
    }
  }, 30000);
});

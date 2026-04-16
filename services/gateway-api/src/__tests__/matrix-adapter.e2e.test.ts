import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { describe, expect, it } from '@jest/globals';

const RUN = process.env.TEST_MATRIX_ADAPTER_E2E === '1';
const ADAPTER_ENTRY =
  process.env.MATRIX_ADAPTER_ENTRY ||
  path.resolve(process.cwd(), '../adapter-matrix/dist/index.js');
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
  const child = spawn('node', [ADAPTER_ENTRY], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  return child;
}

describe('Matrix Adapter E2E (mocked)', () => {
  it('ingest -> gateway event and outbox deliver (optional)', async () => {
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
      matrixSends: [],
    };
    const outboxQueue = [
      {
        id: 'ob-1',
        chat_id: 'chat-1',
        channel: 'matrix',
        channel_chat_id: '!room:test',
        content_type: 'text',
        text: 'hello from outbox',
      },
    ];
    let syncCount = 0;

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
        res.end(JSON.stringify({ success: true, data: { event_id: 'evt-1' } }));
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

    const matrix = await startServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/_matrix/client/v3/account/whoami') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user_id: '@bot:test' }));
        return;
      }
      if (
        req.method === 'GET' &&
        req.url === '/_matrix/client/v3/user/%40bot%3Atest/account_data/m.direct'
      ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/_matrix/client/v3/sync')) {
        syncCount += 1;
        const payload =
          syncCount === 1
            ? {
                next_batch: 's1',
                rooms: {
                  join: {
                    '!room:test': {
                      timeline: {
                        events: [
                          {
                            type: 'm.room.message',
                            sender: '@alice:test',
                            event_id: '$e1',
                            content: { msgtype: 'm.text', body: '/sven hello' },
                          },
                        ],
                      },
                    },
                  },
                },
              }
            : { next_batch: `s${syncCount}`, rooms: { join: {} } };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      if (req.method === 'PUT' && req.url.includes('/send/m.room.message/')) {
        const body = await readJsonBody(req);
        seen.matrixSends.push(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ event_id: '$sent1' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'matrix',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      MATRIX_HOMESERVER_URL: matrix.baseUrl,
      MATRIX_ACCESS_TOKEN: 'mx-token',
      MATRIX_USER_ID: '@bot:test',
      MATRIX_SYNC_MS: '200',
      OUTBOX_POLL_MS: '200',
    });

    try {
      const ok = await waitFor(
        () => seen.gatewayMessageEvents.length > 0 && seen.matrixSends.length > 0 && seen.sentOutboxIds.length > 0,
        15000,
      );
      expect(ok).toBe(true);
      expect(seen.gatewayMessageEvents[0].text).toBe('hello');
      expect(seen.matrixSends[0].body).toContain('hello from outbox');
    } finally {
      adapter.kill('SIGTERM');
      await gateway.close();
      await matrix.close();
    }
  });

  it('matrix file upload handling (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(ADAPTER_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const seen = { gatewayFileEvents: [], matrixUploads: 0, matrixSends: 0 };
    const outboxQueue = [
      {
        id: 'ob-file',
        chat_id: 'chat-1',
        channel: 'matrix',
        channel_chat_id: '!dm:test',
        content_type: 'file',
        text: 'doc',
        file_url: 'http://127.0.0.1:1/fake',
      },
    ];
    let syncCount = 0;

    const fixture = await startServer((req, res) => {
      if (req.url === '/fake') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end(Buffer.from('pdf-data'));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    outboxQueue[0].file_url = `${fixture.baseUrl}/fake`;

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
      if (req.method === 'POST' && req.url === '/v1/events/file') {
        const body = await readJsonBody(req);
        seen.gatewayFileEvents.push(body);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { event_id: 'evt-file' } }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/outbox/next')) {
        const items = outboxQueue.splice(0, 1);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { items } }));
        return;
      }
      if (req.method === 'POST' && req.url.startsWith('/v1/outbox/') && req.url.endsWith('/sent')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const matrix = await startServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/_matrix/client/v3/account/whoami') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user_id: '@bot:test' }));
        return;
      }
      if (
        req.method === 'GET' &&
        req.url === '/_matrix/client/v3/user/%40bot%3Atest/account_data/m.direct'
      ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ '@alice:test': ['!dm:test'] }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/_matrix/client/v3/sync')) {
        syncCount += 1;
        const payload =
          syncCount === 1
            ? {
                next_batch: 'sx1',
                rooms: {
                  join: {
                    '!dm:test': {
                      timeline: {
                        events: [
                          {
                            type: 'm.room.message',
                            sender: '@alice:test',
                            event_id: '$f1',
                            content: {
                              msgtype: 'm.file',
                              body: 'report.pdf',
                              filename: 'report.pdf',
                              url: 'mxc://server/report',
                              info: { mimetype: 'application/pdf' },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              }
            : { next_batch: `sx${syncCount}`, rooms: { join: {} } };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      if (req.method === 'POST' && req.url === '/_matrix/media/v3/upload') {
        seen.matrixUploads += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content_uri: 'mxc://server/up1' }));
        return;
      }
      if (req.method === 'PUT' && req.url.includes('/send/m.room.message/')) {
        seen.matrixSends += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ event_id: '$send-file' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'matrix',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      MATRIX_HOMESERVER_URL: matrix.baseUrl,
      MATRIX_ACCESS_TOKEN: 'mx-token',
      MATRIX_USER_ID: '@bot:test',
      MATRIX_SYNC_MS: '200',
      OUTBOX_POLL_MS: '200',
    });

    try {
      const ok = await waitFor(
        () => seen.gatewayFileEvents.length > 0 && seen.matrixUploads > 0 && seen.matrixSends > 0,
        15000,
      );
      expect(ok).toBe(true);
      expect(seen.gatewayFileEvents[0].file_name).toBe('report.pdf');
    } finally {
      adapter.kill('SIGTERM');
      await fixture.close();
      await gateway.close();
      await matrix.close();
    }
  });

  it('matrix approval via reactions (optional)', async () => {
    if (!RUN) {
      expect(true).toBe(true);
      return;
    }
    if (!fs.existsSync(ADAPTER_ENTRY)) {
      expect(true).toBe(true);
      return;
    }

    const seen = { gatewayMessageEvents: [] };
    let syncCount = 0;

    const gateway = await startServer(async (req, res) => {
      if (req.headers['x-sven-adapter-token'] !== ADAPTER_TOKEN) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/events/message') {
        const body = await readJsonBody(req);
        seen.gatewayMessageEvents.push(body);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { event_id: 'evt-vote' } }));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/v1/outbox/next')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { items: [] } }));
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
      res.writeHead(404);
      res.end();
    });

    const matrix = await startServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/_matrix/client/v3/account/whoami') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ user_id: '@bot:test' }));
        return;
      }
      if (
        req.method === 'GET' &&
        req.url === '/_matrix/client/v3/user/%40bot%3Atest/account_data/m.direct'
      ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }
      if (req.method === 'GET' && req.url.startsWith('/_matrix/client/v3/sync')) {
        syncCount += 1;
        const payload =
          syncCount === 1
            ? {
                next_batch: 'rv1',
                rooms: {
                  join: {
                    '!room:test': {
                      timeline: {
                        events: [
                          {
                            type: 'm.reaction',
                            sender: '@alice:test',
                            event_id: '$r1',
                            content: {
                              'm.relates_to': {
                                rel_type: 'm.annotation',
                                event_id: '$target1',
                                key: 'approve appr-123',
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              }
            : { next_batch: `rv${syncCount}`, rooms: { join: {} } };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const adapter = startAdapter({
      ADAPTER_CHANNEL: 'matrix',
      GATEWAY_URL: gateway.baseUrl,
      SVEN_ADAPTER_TOKEN: ADAPTER_TOKEN,
      MATRIX_HOMESERVER_URL: matrix.baseUrl,
      MATRIX_ACCESS_TOKEN: 'mx-token',
      MATRIX_USER_ID: '@bot:test',
      MATRIX_SYNC_MS: '200',
      OUTBOX_POLL_MS: '200',
    });

    try {
      const ok = await waitFor(() => seen.gatewayMessageEvents.length > 0, 10000);
      expect(ok).toBe(true);
      expect(seen.gatewayMessageEvents[0].text).toBe('approve appr-123');
      expect(seen.gatewayMessageEvents[0].metadata?.is_approval_vote).toBe(true);
    } finally {
      adapter.kill('SIGTERM');
      await gateway.close();
      await matrix.close();
    }
  });
});

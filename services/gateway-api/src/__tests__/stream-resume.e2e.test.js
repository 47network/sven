import http from 'http';
import Fastify from 'fastify';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { registerStreamRoutes } from '../routes/streams.js';

const TOKENS = {
  owner: 'session-owner',
  foreignUser: 'session-foreign-user',
  foreignOrg: 'session-foreign-org',
};

function createPoolQueryMock() {
  const sessions = new Map([
    [
      TOKENS.owner,
      {
        user_id: '11111111-1111-1111-1111-111111111111',
        role: 'user',
        active_organization_id: 'org-owner',
      },
    ],
    [
      TOKENS.foreignUser,
      {
        user_id: '22222222-2222-2222-2222-222222222222',
        role: 'user',
        active_organization_id: 'org-owner',
      },
    ],
    [
      TOKENS.foreignOrg,
      {
        user_id: '11111111-1111-1111-1111-111111111111',
        role: 'user',
        active_organization_id: 'org-foreign',
      },
    ],
  ]);

  return jest.fn(async (query, params) => {
    const sql = String(query || '');
    if (sql.includes('FROM sessions s')) {
      const session = sessions.get(String(params?.[0] || ''));
      return { rows: session ? [session] : [] };
    }
    if (sql.includes('auth_user_rate_limits')) {
      return {
        rows: [{ count: 1, window_start_epoch: Math.floor(Date.now() / 1000) }],
      };
    }
    return { rows: [] };
  });
}

async function apiCall(apiBase, method, endpoint, body, bearerToken) {
  return new Promise((resolve, reject) => {
    const url = `${apiBase}${endpoint}`;
    const parsed = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

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

function parseSseEvent(raw) {
  const lines = raw.split('\n');
  const out = { id: '', event: '', data: '' };
  for (const line of lines) {
    if (line.startsWith('id:')) out.id = line.slice(3).trim();
    if (line.startsWith('event:')) out.event = line.slice(6).trim();
    if (line.startsWith('data:')) out.data += line.slice(5).trim();
  }
  return out;
}

async function readFirstSseEvent(endpoint, cookie, lastEventId) {
  return new Promise((resolve, reject) => {
    const url = endpoint;
    const parsed = new URL(url);
    const headers = {};
    if (cookie) headers.Authorization = `Bearer ${cookie}`;
    if (lastEventId) headers['Last-Event-ID'] = String(lastEventId);

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
        const timeout = setTimeout(() => {
          req.destroy(new Error('SSE timeout'));
        }, 10_000);
        res.on('data', (chunk) => {
          buffer += String(chunk);
          const parts = buffer.split('\n\n');
          while (parts.length > 1) {
            const ev = parts.shift();
            if (ev && ev.includes('data:')) {
              clearTimeout(timeout);
              const parsedEv = parseSseEvent(ev);
              req.destroy();
              resolve(parsedEv);
              return;
            }
          }
          buffer = parts[0] || '';
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Resumable Streaming', () => {
  let app;
  let apiBase;

  beforeEach(async () => {
    const poolQuery = createPoolQueryMock();
    app = Fastify({ logger: false });
    await registerStreamRoutes(app, { query: poolQuery });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    const port = address && typeof address === 'object' ? address.port : 0;
    apiBase = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('disconnect mid-stream -> reconnect with Last-Event-ID -> resume from next event', async () => {
    const created = await apiCall(apiBase, 'POST', '/v1/streams', { ttl_ms: 60000 }, TOKENS.owner);
    expect(created.statusCode).toBe(201);
    const streamId = created.data?.data?.stream_id;
    expect(typeof streamId).toBe('string');

    const first = await apiCall(
      apiBase,
      'POST',
      `/v1/streams/${encodeURIComponent(streamId)}/events`,
      { type: 'token', data: { idx: 1, text: 'hello' } },
      TOKENS.owner,
    );
    expect(first.statusCode).toBe(200);

    const ev1 = await readFirstSseEvent(`${apiBase}/v1/streams/${encodeURIComponent(streamId)}/sse`, TOKENS.owner);
    expect(ev1.id).toBe(String(first.data?.data?.event_id || '1'));

    const second = await apiCall(
      apiBase,
      'POST',
      `/v1/streams/${encodeURIComponent(streamId)}/events`,
      { type: 'token', data: { idx: 2, text: 'world' } },
      TOKENS.owner,
    );
    expect(second.statusCode).toBe(200);

    const ev2 = await readFirstSseEvent(
      `${apiBase}/v1/streams/${encodeURIComponent(streamId)}/sse`,
      TOKENS.owner,
      ev1.id,
    );
    expect(ev2.id).toBe(String(second.data?.data?.event_id || '2'));
    const parsedData = JSON.parse(ev2.data || '{}');
    expect(parsedData.idx).toBe(2);
  });

  it('denies foreign user stream reads/writes/SSE access', async () => {
    const created = await apiCall(apiBase, 'POST', '/v1/streams', { ttl_ms: 60000 }, TOKENS.owner);
    expect(created.statusCode).toBe(201);
    const streamId = created.data?.data?.stream_id;

    const postForeign = await apiCall(
      apiBase,
      'POST',
      `/v1/streams/${encodeURIComponent(streamId)}/events`,
      { type: 'token', data: { idx: 9 } },
      TOKENS.foreignUser,
    );
    expect(postForeign.statusCode).toBe(403);
    expect(postForeign.data?.error?.code).toBe('FORBIDDEN');

    const getForeign = await apiCall(
      apiBase,
      'GET',
      `/v1/streams/${encodeURIComponent(streamId)}/events?after=0&limit=10`,
      undefined,
      TOKENS.foreignUser,
    );
    expect(getForeign.statusCode).toBe(403);
    expect(getForeign.data?.error?.code).toBe('FORBIDDEN');

    const sseForeign = await apiCall(
      apiBase,
      'GET',
      `/v1/streams/${encodeURIComponent(streamId)}/sse`,
      undefined,
      TOKENS.foreignUser,
    );
    expect(sseForeign.statusCode).toBe(403);
    expect(sseForeign.data?.error?.code).toBe('FORBIDDEN');
  });

  it('denies same-user access when org does not match stream owner org', async () => {
    const created = await apiCall(apiBase, 'POST', '/v1/streams', { ttl_ms: 60000 }, TOKENS.owner);
    expect(created.statusCode).toBe(201);
    const streamId = created.data?.data?.stream_id;

    const foreignOrgRead = await apiCall(
      apiBase,
      'GET',
      `/v1/streams/${encodeURIComponent(streamId)}/events?after=0&limit=10`,
      undefined,
      TOKENS.foreignOrg,
    );
    expect(foreignOrgRead.statusCode).toBe(403);
    expect(foreignOrgRead.data?.error?.code).toBe('FORBIDDEN');
  });
});

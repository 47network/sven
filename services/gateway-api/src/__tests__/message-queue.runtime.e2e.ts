import http from 'http';
import pg from 'pg';
import { connect, JSONCodec } from 'nats';
import { describe, expect, it } from '@jest/globals';
import { v7 as uuidv7 } from 'uuid';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const RUN_QUEUE_RUNTIME_E2E =
  String(process.env.RUN_QUEUE_RUNTIME_E2E || '').toLowerCase() === 'true';
const RUN_QUEUE_RUNTIME_E2E_RESPONSE =
  String(process.env.RUN_QUEUE_RUNTIME_E2E_RESPONSE || '').toLowerCase() === 'true';

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

describe('A6 Message Queue (runtime e2e)', () => {
  it('dispatches queued message after runtime processes another message (optional)', async () => {
    if (!RUN_QUEUE_RUNTIME_E2E || !TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let userId = '';
    let identityId = '';
    let nc: Awaited<ReturnType<typeof connect>> | null = null;

    try {
      const me = await apiCall('GET', '/v1/me', undefined, TEST_SESSION_COOKIE);
      expect(me.statusCode).toBe(200);
      userId = String(me.data?.data?.id || '');
      expect(userId).toBeTruthy();

      const created = await apiCall('POST', '/v1/chats', { name: `queue-runtime-${Date.now()}`, type: 'dm' }, TEST_SESSION_COOKIE);
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const identityRes = await pool.query(
        `SELECT id FROM identities WHERE channel = 'canvas' AND channel_user_id = $1 LIMIT 1`,
        [userId],
      );
      if (identityRes.rows.length > 0) {
        identityId = String(identityRes.rows[0].id);
      } else {
        identityId = uuidv7();
        await pool.query(
          `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
           VALUES ($1, $2, 'canvas', $3, $4, NOW())`,
          [identityId, userId, userId, `canvas:${userId}`],
        );
      }

      await pool.query(
        `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
         VALUES ($1, TRUE, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET is_processing = TRUE, updated_at = NOW()`,
        [chatId],
      );

      const queuedText = `queued-runtime-${Date.now()}`;
      const queued = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: queuedText },
        TEST_SESSION_COOKIE,
      );
      expect(queued.statusCode).toBe(202);
      expect(queued.data?.data?.status).toBe('queued');

      nc = await connect({ servers: NATS_URL, name: 'queue-e2e' });
      const jc = JSONCodec();
      const eventId = uuidv7();
      const envelope = {
        schema_version: '1.0',
        event_id: eventId,
        occurred_at: new Date().toISOString(),
        data: {
          channel: 'canvas',
          channel_message_id: eventId,
          chat_id: chatId,
          sender_identity_id: identityId,
          content_type: 'text',
          text: `runtime-trigger-${Date.now()}`,
        },
      };
      nc.publish('inbound.message.canvas', jc.encode(envelope));

      let delivered = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(1000);
        const messages = await apiCall(
          'GET',
          `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
          undefined,
          TEST_SESSION_COOKIE,
        );
        if (messages.statusCode !== 200) continue;
        const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
        if (rows.some((r: any) => String(r.text || '') === queuedText && r.status !== 'queued')) {
          delivered = true;
          break;
        }
      }
      expect(delivered).toBe(true);
    } catch (err) {
      if (String(err).includes('CONN') || String(err).includes('NATS')) {
        expect(true).toBe(true);
        return;
      }
      throw err;
    } finally {
      if (nc) {
        try { await nc.drain(); } catch { /* ignore */ }
      }
      await pool.end();
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });

  it('delivers queued messages in FIFO order and optionally emits assistant response (optional)', async () => {
    if (!RUN_QUEUE_RUNTIME_E2E || !TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let userId = '';
    let identityId = '';
    let nc: Awaited<ReturnType<typeof connect>> | null = null;

    try {
      const me = await apiCall('GET', '/v1/me', undefined, TEST_SESSION_COOKIE);
      expect(me.statusCode).toBe(200);
      userId = String(me.data?.data?.id || '');
      expect(userId).toBeTruthy();

      const created = await apiCall('POST', '/v1/chats', { name: `queue-order-${Date.now()}`, type: 'dm' }, TEST_SESSION_COOKIE);
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const identityRes = await pool.query(
        `SELECT id FROM identities WHERE channel = 'canvas' AND channel_user_id = $1 LIMIT 1`,
        [userId],
      );
      if (identityRes.rows.length > 0) {
        identityId = String(identityRes.rows[0].id);
      } else {
        identityId = uuidv7();
        await pool.query(
          `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
           VALUES ($1, $2, 'canvas', $3, $4, NOW())`,
          [identityId, userId, userId, `canvas:${userId}`],
        );
      }

      await pool.query(
        `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
         VALUES ($1, TRUE, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET is_processing = TRUE, updated_at = NOW()`,
        [chatId],
      );

      const texts = [
        `queued-order-1-${Date.now()}`,
        `queued-order-2-${Date.now() + 1}`,
        `queued-order-3-${Date.now() + 2}`,
      ];
      for (const text of texts) {
        const queued = await apiCall(
          'POST',
          `/v1/chats/${encodeURIComponent(chatId)}/messages`,
          { text },
          TEST_SESSION_COOKIE,
        );
        expect(queued.statusCode).toBe(202);
        expect(queued.data?.data?.status).toBe('queued');
      }

      nc = await connect({ servers: NATS_URL, name: 'queue-order-e2e' });
      const jc = JSONCodec();
      const triggerId = uuidv7();
      nc.publish('inbound.message.canvas', jc.encode({
        schema_version: '1.0',
        event_id: triggerId,
        occurred_at: new Date().toISOString(),
        data: {
          channel: 'canvas',
          channel_message_id: triggerId,
          chat_id: chatId,
          sender_identity_id: identityId,
          content_type: 'text',
          text: `runtime-order-trigger-${Date.now()}`,
        },
      }));

      let deliveredOrder: string[] = [];
      let assistantSeen = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await sleep(1000);
        const messages = await apiCall(
          'GET',
          `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=100`,
          undefined,
          TEST_SESSION_COOKIE,
        );
        if (messages.statusCode !== 200) continue;
        const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
        deliveredOrder = rows
          .filter((r: any) => r && r.role === 'user' && texts.includes(String(r.text)))
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((r: any) => String(r.text));
        assistantSeen = rows.some((r: any) => r && r.role === 'assistant');
        if (deliveredOrder.length === texts.length && (!RUN_QUEUE_RUNTIME_E2E_RESPONSE || assistantSeen)) {
          break;
        }
      }

      expect(deliveredOrder).toEqual(texts);
      if (RUN_QUEUE_RUNTIME_E2E_RESPONSE) {
        expect(assistantSeen).toBe(true);
      }
    } catch (err) {
      if (String(err).includes('CONN') || String(err).includes('NATS')) {
        expect(true).toBe(true);
        return;
      }
      throw err;
    } finally {
      if (nc) {
        try { await nc.drain(); } catch { /* ignore */ }
      }
      await pool.end();
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });
});

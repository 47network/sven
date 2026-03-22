import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

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

describe('A6 Message Queue (integration)', () => {
  it('queues messages while processing, enforces depth, supports cancel (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let queueId = '';
    let previousDepth: string | null = null;

    try {
      const created = await apiCall('POST', '/v1/chats', { name: `queue-test-${Date.now()}`, type: 'dm' }, TEST_SESSION_COOKIE);
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      // Force processing state true for this chat.
      await pool.query(
        `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
         VALUES ($1, TRUE, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET is_processing = TRUE, updated_at = NOW()`,
        [chatId],
      );

      const queued = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: 'queued-1' },
        TEST_SESSION_COOKIE,
      );
      expect(queued.statusCode).toBe(202);
      expect(queued.data?.data?.status).toBe('queued');
      queueId = String(queued.data?.data?.queue_id || queued.data?.data?.id || '');
      expect(queueId).toBeTruthy();

      // Reduce queue depth for deterministic enforcement.
      const prev = await pool.query(
        `SELECT value FROM settings_global WHERE key = 'chat.messageQueue.maxDepth'`,
      );
      if (prev.rows.length > 0) {
        previousDepth = JSON.stringify(prev.rows[0].value ?? '10');
      }
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at, updated_by)
         VALUES ('chat.messageQueue.maxDepth', '2'::jsonb, NOW(), 'test')
         ON CONFLICT (key) DO UPDATE SET value = '2'::jsonb, updated_at = NOW(), updated_by = 'test'`,
      );

      // Queue second message (should succeed), third should hit depth limit.
      const queued2 = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: 'queued-2' },
        TEST_SESSION_COOKIE,
      );
      expect(queued2.statusCode).toBe(202);

      const queued3 = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: 'queued-3' },
        TEST_SESSION_COOKIE,
      );
      expect(queued3.statusCode).toBe(429);
      expect(queued3.data?.error?.code).toBe('QUEUE_DEPTH_EXCEEDED');

      // Cancel first queued message.
      const cancelled = await apiCall(
        'DELETE',
        `/v1/chats/${encodeURIComponent(chatId)}/queue/${encodeURIComponent(queueId)}`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(cancelled.statusCode).toBe(200);
      expect(cancelled.data?.data?.cancelled).toBe(true);

      const messages = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(messages.statusCode).toBe(200);
      const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
      expect(rows.some((r: any) => String(r.id) === queueId)).toBe(false);
    } finally {
      try {
        if (previousDepth !== null) {
          await pool.query(
            `UPDATE settings_global
             SET value = $1::jsonb, updated_at = NOW(), updated_by = 'test'
             WHERE key = 'chat.messageQueue.maxDepth'`,
            [previousDepth],
          );
        }
      } catch {
        // ignore reset failure
      }
      await pool.end();
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });

  it('queues three messages with FIFO positions while processing (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';

    try {
      const created = await apiCall('POST', '/v1/chats', { name: `queue-fifo-${Date.now()}`, type: 'dm' }, TEST_SESSION_COOKIE);
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      await pool.query(
        `INSERT INTO chat_processing_state (chat_id, is_processing, updated_at)
         VALUES ($1, TRUE, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET is_processing = TRUE, updated_at = NOW()`,
        [chatId],
      );

      const texts = ['fifo-1', 'fifo-2', 'fifo-3'];
      for (const text of texts) {
        const res = await apiCall(
          'POST',
          `/v1/chats/${encodeURIComponent(chatId)}/messages`,
          { text },
          TEST_SESSION_COOKIE,
        );
        expect(res.statusCode).toBe(202);
        expect(res.data?.data?.status).toBe('queued');
      }

      const messages = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
        undefined,
        TEST_SESSION_COOKIE,
      );
      expect(messages.statusCode).toBe(200);
      const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
      const queued = rows
        .filter((r: any) => r && r.status === 'queued' && texts.includes(String(r.text)))
        .sort((a: any, b: any) => Number(a.queue_position || 0) - Number(b.queue_position || 0));
      expect(queued.length).toBe(3);
      expect(queued[0]?.queue_position).toBe(1);
      expect(queued[1]?.queue_position).toBe(2);
      expect(queued[2]?.queue_position).toBe(3);
    } finally {
      await pool.end();
      if (chatId) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, TEST_SESSION_COOKIE);
      }
    }
  });
});

import http from 'http';
import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

type ApiResult = {
  statusCode: number;
  data: any;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts?.cookie) headers.cookie = opts.cookie;

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
          resolve({
            statusCode: res.statusCode || 0,
            data: parsedBody,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getBearerFromSessionCookie(cookie: string): Promise<string> {
  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `B3 Action Buttons E2E ${Date.now()}`,
    client_type: 'ci',
    scope: 'chat approvals',
  });
  expect(started.statusCode).toBe(200);

  const deviceCode = String(started.data?.data?.device_code || '');
  const userCode = String(started.data?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall(
    'POST',
    '/v1/auth/device/confirm',
    { user_code: userCode },
    { cookie },
  );
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String(tokenResp.data?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

describe('B3 Action Buttons (e2e)', () => {
  it('agent action buttons can execute quick reply message flow (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let bearer = '';

    try {
      bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const me = await apiCall('GET', '/v1/me', undefined, { bearer });
      expect(me.statusCode).toBe(200);
      const userId = String(me.data?.data?.id || '');
      expect(userId).toBeTruthy();

      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `b3-actions-${Date.now()}`, type: 'dm' },
        { bearer },
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const assistantMessageId = newId('msg');
      const quickReplyText = `B3 quick reply ${Date.now()}`;
      const blocks = [
        {
          type: 'actions',
          buttons: [
            {
              id: 'quick-reply',
              label: 'Send quick reply',
              action: 'reply',
              text: quickReplyText,
            },
          ],
        },
      ];

      await pool.query(
        `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, $3, 'assistant', 'blocks', NULL, $4::jsonb, NOW())`,
        [assistantMessageId, chatId, userId, JSON.stringify(blocks)],
      );

      const beforeClick = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
        undefined,
        { bearer },
      );
      expect(beforeClick.statusCode).toBe(200);
      const rowsBefore = Array.isArray(beforeClick.data?.data?.rows) ? beforeClick.data.data.rows : [];
      const injected = rowsBefore.find((row: any) => String(row.id) === assistantMessageId);
      expect(injected).toBeTruthy();
      expect(injected?.content_type).toBe('blocks');
      expect(Array.isArray(injected?.blocks)).toBe(true);
      expect(injected?.blocks?.[0]?.type).toBe('actions');

      // Simulate clicking the quick-reply button: UI sends message text back to chat.
      const clickResult = await apiCall(
        'POST',
        `/v1/chats/${encodeURIComponent(chatId)}/messages`,
        { text: quickReplyText },
        { bearer },
      );
      expect(clickResult.statusCode).toBe(201);

      const afterClick = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
        undefined,
        { bearer },
      );
      expect(afterClick.statusCode).toBe(200);
      const rowsAfter = Array.isArray(afterClick.data?.data?.rows) ? afterClick.data.data.rows : [];
      expect(rowsAfter.some((row: any) => row?.role === 'user' && String(row?.text || '') === quickReplyText)).toBe(true);
    } finally {
      await pool.end();
      if (chatId && bearer) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, { bearer });
      }
    }
  });

  it('pending approval flow surfaces renderable button context and resolves by vote (optional)', async () => {
    if (!TEST_SESSION_COOKIE || !DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    let chatId = '';
    let bearer = '';

    try {
      bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const me = await apiCall('GET', '/v1/me', undefined, { bearer });
      expect(me.statusCode).toBe(200);
      const userId = String(me.data?.data?.id || '');
      expect(userId).toBeTruthy();

      const created = await apiCall(
        'POST',
        '/v1/chats',
        { name: `b3-approval-${Date.now()}`, type: 'dm' },
        { bearer },
      );
      expect(created.statusCode).toBe(201);
      chatId = String(created.data?.data?.id || '');
      expect(chatId).toBeTruthy();

      const approvalId = newId('appr');
      await pool.query(
        `INSERT INTO approvals (
          id, chat_id, tool_name, scope, requester_user_id, status,
          quorum_required, votes_approve, votes_deny, expires_at, details, created_at
        ) VALUES (
          $1, $2, 'tool.test', 'tool.write', $3, 'pending',
          1, 0, 0, NOW() + INTERVAL '30 minutes', $4::jsonb, NOW()
        )`,
        [approvalId, chatId, userId, JSON.stringify({ reason: 'B3 approval button test' })],
      );

      const assistantMessageId = newId('msg');
      const blocks = [
        {
          type: 'tool_card',
          content: {
            tool_name: 'tool.test',
            status: 'pending_approval',
            approval_id: approvalId,
          },
        },
      ];

      await pool.query(
        `INSERT INTO messages (id, chat_id, sender_user_id, role, content_type, text, blocks, created_at)
         VALUES ($1, $2, $3, 'assistant', 'blocks', NULL, $4::jsonb, NOW())`,
        [assistantMessageId, chatId, userId, JSON.stringify(blocks)],
      );

      const messages = await apiCall(
        'GET',
        `/v1/chats/${encodeURIComponent(chatId)}/messages?limit=50`,
        undefined,
        { bearer },
      );
      expect(messages.statusCode).toBe(200);
      const rows = Array.isArray(messages.data?.data?.rows) ? messages.data.data.rows : [];
      const withToolCard = rows.find((row: any) => String(row.id) === assistantMessageId);
      expect(withToolCard).toBeTruthy();
      expect(withToolCard?.content_type).toBe('blocks');
      expect(withToolCard?.blocks?.[0]?.type).toBe('tool_card');
      expect(withToolCard?.blocks?.[0]?.content?.status).toBe('pending_approval');
      expect(String(withToolCard?.blocks?.[0]?.content?.approval_id || '')).toBe(approvalId);

      const vote = await apiCall(
        'POST',
        `/v1/approvals/${encodeURIComponent(approvalId)}/vote`,
        { decision: 'approve' },
        { bearer },
      );
      expect(vote.statusCode).toBe(200);

      const approvalCheck = await pool.query(
        `SELECT status, votes_approve, votes_deny FROM approvals WHERE id = $1`,
        [approvalId],
      );
      expect(approvalCheck.rows.length).toBe(1);
      expect(String(approvalCheck.rows[0].status)).toBe('approved');
      expect(Number(approvalCheck.rows[0].votes_approve || 0)).toBeGreaterThanOrEqual(1);
    } finally {
      await pool.end();
      if (chatId && bearer) {
        await apiCall('DELETE', `/v1/chats/${encodeURIComponent(chatId)}`, undefined, { bearer });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Agent Messaging — inter-agent communication + crew coordination.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('agent-messaging');

const VALID_MESSAGE_TYPES = ['info', 'alert', 'anomaly', 'report', 'command', 'task_update'] as const;
const VALID_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

export function registerAgentMessagingRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // POST /messages — send a message
  app.post('/messages', async (req, reply) => {
    const body = req.body as {
      from_agent_id?: string;
      to_agent_id?: string;
      crew_id?: string;
      subject?: string;
      body?: string;
      message_type?: string;
      priority?: string;
    };

    if (!body.from_agent_id) return reply.status(400).send({ success: false, error: 'from_agent_id is required' });
    if (!body.subject?.trim()) return reply.status(400).send({ success: false, error: 'subject is required' });
    if (!body.body?.trim()) return reply.status(400).send({ success: false, error: 'body is required' });
    if (!body.to_agent_id && !body.crew_id) {
      return reply.status(400).send({ success: false, error: 'Either to_agent_id or crew_id is required' });
    }

    const msgType = body.message_type && VALID_MESSAGE_TYPES.includes(body.message_type as any)
      ? body.message_type : 'info';
    const priority = body.priority && VALID_PRIORITIES.includes(body.priority as any)
      ? body.priority : 'normal';

    const id = newId('msg');
    const res = await pool.query(
      `INSERT INTO agent_messages
         (id, from_agent_id, to_agent_id, crew_id, subject, body, message_type, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, body.from_agent_id, body.to_agent_id ?? null, body.crew_id ?? null,
       body.subject.trim(), body.body.trim(), msgType, priority],
    );

    logger.info('Message sent', { id, from: body.from_agent_id, to: body.to_agent_id, crew: body.crew_id });
    publishNats(natsConn, 'sven.agent.message_sent', {
      messageId: id, from: body.from_agent_id, to: body.to_agent_id,
      crewId: body.crew_id, subject: body.subject, type: msgType, priority,
    });

    return reply.status(201).send({ success: true, message: res.rows[0] });
  });

  // GET /messages — list messages
  app.get('/messages', async (req, reply) => {
    const q = req.query as {
      to_agent_id?: string; crew_id?: string; message_type?: string;
      unread_only?: string; limit?: string; offset?: string;
    };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = '1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (q.to_agent_id) { where += ` AND to_agent_id = $${idx++}`; params.push(q.to_agent_id); }
    if (q.crew_id) { where += ` AND crew_id = $${idx++}`; params.push(q.crew_id); }
    if (q.message_type && VALID_MESSAGE_TYPES.includes(q.message_type as any)) {
      where += ` AND message_type = $${idx++}`; params.push(q.message_type);
    }
    if (q.unread_only === 'true') { where += ' AND read_at IS NULL'; }

    const res = await pool.query(
      `SELECT * FROM agent_messages WHERE ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
    return reply.send({ success: true, messages: res.rows, pagination: { limit, offset, returned: res.rows.length } });
  });

  // GET /messages/:messageId — single message
  app.get('/messages/:messageId', async (req, reply) => {
    const { messageId } = req.params as { messageId: string };
    const res = await pool.query('SELECT * FROM agent_messages WHERE id = $1', [messageId]);
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Message not found' });
    return reply.send({ success: true, message: res.rows[0] });
  });

  // PATCH /messages/:messageId/read — mark as read
  app.patch('/messages/:messageId/read', async (req, reply) => {
    const { messageId } = req.params as { messageId: string };
    const res = await pool.query(
      'UPDATE agent_messages SET read_at = NOW() WHERE id = $1 AND read_at IS NULL RETURNING *',
      [messageId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Message not found or already read' });
    return reply.send({ success: true, message: res.rows[0] });
  });

  // GET /messages/unread-count — unread per agent
  app.get('/messages/unread-count', async (req, reply) => {
    const q = req.query as { agent_id?: string };
    if (!q.agent_id) return reply.status(400).send({ success: false, error: 'agent_id query param required' });
    const res = await pool.query(
      `SELECT COUNT(*)::int AS unread
         FROM agent_messages
        WHERE to_agent_id = $1 AND read_at IS NULL`,
      [q.agent_id],
    );
    return reply.send({ success: true, agentId: q.agent_id, unread: res.rows[0]?.unread ?? 0 });
  });

  // POST /messages/broadcast — broadcast to all active agents
  app.post('/messages/broadcast', async (req, reply) => {
    const body = req.body as {
      from_agent_id?: string;
      subject?: string;
      body?: string;
      message_type?: string;
      priority?: string;
    };

    if (!body.from_agent_id) return reply.status(400).send({ success: false, error: 'from_agent_id is required' });
    if (!body.subject?.trim()) return reply.status(400).send({ success: false, error: 'subject is required' });
    if (!body.body?.trim()) return reply.status(400).send({ success: false, error: 'body is required' });

    const msgType = body.message_type && VALID_MESSAGE_TYPES.includes(body.message_type as any)
      ? body.message_type : 'info';
    const priority = body.priority && VALID_PRIORITIES.includes(body.priority as any)
      ? body.priority : 'normal';

    // Get all active agents
    let agents: Array<{ agent_id: string }> = [];
    try {
      const res = await pool.query(
        `SELECT agent_id FROM agent_profiles WHERE status = 'active' AND agent_id != $1`,
        [body.from_agent_id],
      );
      agents = res.rows;
    } catch { /* table may not exist */ }

    const ids: string[] = [];
    for (const agent of agents) {
      const id = newId('msg');
      ids.push(id);
      await pool.query(
        `INSERT INTO agent_messages
           (id, from_agent_id, to_agent_id, subject, body, message_type, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, body.from_agent_id, agent.agent_id, body.subject!.trim(), body.body!.trim(), msgType, priority],
      );
    }

    logger.info('Broadcast sent', { from: body.from_agent_id, recipients: agents.length });
    publishNats(natsConn, 'sven.agent.message_sent', {
      broadcast: true, from: body.from_agent_id, recipients: agents.length,
      subject: body.subject, type: msgType, priority,
    });

    return reply.status(201).send({ success: true, sent: agents.length, messageIds: ids });
  });
}

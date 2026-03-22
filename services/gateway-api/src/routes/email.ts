import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { JSONCodec, NatsConnection } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, InboundMessageEvent, RuntimeDispatchEvent } from '@sven/shared';
import { GmailService } from '../services/GmailService.js';
import { withCorrelationMetadata } from '../lib/correlation.js';

const jc = JSONCodec();

function publishRuntimeDispatch(nc: NatsConnection, data: RuntimeDispatchEvent) {
  const event: EventEnvelope<RuntimeDispatchEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data,
  };
  nc.publish(NATS_SUBJECTS.RUNTIME_DISPATCH, jc.encode(event));
}

export async function registerEmailRoutes(app: FastifyInstance, pool: pg.Pool, nc: NatsConnection) {
  const gmail = new GmailService(pool);

  app.post('/v1/email/push', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
        properties: {
          subscription: { type: 'string' },
          message: {
            type: 'object',
            additionalProperties: true,
            properties: {
              data: { type: 'string' },
              messageId: { type: 'string' },
              publishTime: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const correlationId = request.correlationId || String(request.id || uuidv7());
    const query = (request.query || {}) as { token?: string };
    const token = String(query.token || request.headers['x-gmail-token'] || '');
    const expectedToken = await getPushToken(pool);
    if (!expectedToken) {
      reply.status(503).send({
        success: false,
        error: { code: 'EMAIL_PUSH_TOKEN_REQUIRED', message: 'Email push verification token is not configured' },
      });
      return;
    }
    if (expectedToken && token !== expectedToken) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
      return;
    }

    const body = (request.body || {}) as any;
    const subName = String(body.subscription || '').trim();
    const parsedPayload = decodePubsubMessage(body.message?.data);
    const rawPayload = {
      subscription: subName,
      message: body.message || {},
      parsed: parsedPayload,
    };

    const res = await pool.query(
      `SELECT id, pubsub_subscription, handler, config
       FROM email_subscriptions
       WHERE enabled = TRUE AND ($1 = '' OR pubsub_subscription = $1 OR pubsub_subscription = '*')`,
      [subName],
    );

    if (res.rows.length === 0) {
      reply.send({ success: true, data: { processed: 0 } });
      return;
    }

    let processed = 0;
    for (const row of res.rows) {
      const subId = String(row.id);
      try {
        const config = parseJson(row.config) as Record<string, unknown>;
        await executeEmailHandler(pool, nc, gmail, String(row.handler), config, rawPayload, correlationId);
        await pool.query(
          `UPDATE email_subscriptions SET last_received = NOW(), updated_at = NOW() WHERE id = $1`,
          [subId],
        );
        await logEmailEvent(pool, subId, 'success', rawPayload);
        processed += 1;
      } catch (err) {
        await logEmailEvent(pool, subId, 'error', rawPayload, String(err));
      }
    }

    reply.send({ success: true, data: { processed } });
  });
}

async function executeEmailHandler(
  pool: pg.Pool,
  nc: NatsConnection,
  gmail: GmailService,
  handler: string,
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<void> {
  const parsed = (payload.parsed || {}) as Record<string, unknown>;
  if (handler === 'nats_event') {
    const subject = String(config.subject || 'email.received');
    nc.publish(
      subject,
      jc.encode({
        schema_version: '1.0',
        event_id: uuidv7(),
        occurred_at: new Date().toISOString(),
        data: payload,
        metadata: { correlation_id: correlationId },
      }),
    );
    return;
  }

  if (handler === 'workflow') {
    const workflowId = String(config.workflow_id || '');
    if (!workflowId) throw new Error('workflow handler requires config.workflow_id');
    const wf = await pool.query(
      `SELECT COALESCE(MAX(version), 1) AS version
       FROM workflow_versions
       WHERE workflow_id = $1`,
      [workflowId],
    );
    const workflowVersion = Number(wf.rows[0]?.version || 1);
    const runId = uuidv7();
    await pool.query(
      `INSERT INTO workflow_runs (id, workflow_id, workflow_version, status, input_variables, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), NOW())`,
      [runId, workflowId, workflowVersion, JSON.stringify({ email_payload: payload })],
    );
    publishRuntimeDispatch(nc, {
      kind: 'workflow.execute',
      run_id: runId,
      workflow_id: workflowId,
      workflow_version: workflowVersion,
    });
    return;
  }

  if (handler === 'agent_message') {
    const channel = String(config.channel || '');
    const chatId = String(config.chat_id || '');
    const senderIdentityId = String(config.sender_identity_id || '');
    if (!channel || !chatId || !senderIdentityId) {
      throw new Error('agent_message handler requires config.channel/chat_id/sender_identity_id');
    }

    const emailAddress = String(parsed.emailAddress || '');
    const historyId = String(parsed.historyId || '');
    let text = `New Gmail event: ${emailAddress || 'unknown'} history ${historyId || 'n/a'}`;
    const messageId = String(parsed.messageId || '');
    const fetchFull = config.fetch_message === true || config.fetch_message === 'true';
    if (fetchFull && messageId) {
      const full = await gmail.getMessage(messageId, 'full', String(config.gmail_user_id || 'me'));
      const snippet = String(full?.snippet || '').trim();
      if (snippet) text = snippet;
    }

    const id = uuidv7();
    await pool.query(
      `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, text, channel_message_id, created_at)
       VALUES ($1, $2, $3, 'user', 'text', $4, $5, NOW())`,
      [id, chatId, senderIdentityId, text, `email:${id}`],
    );

    const envelope: EventEnvelope<InboundMessageEvent> = {
      schema_version: '1.0',
      event_id: id,
      occurred_at: new Date().toISOString(),
      data: {
        channel,
        channel_message_id: `email:${id}`,
        chat_id: chatId,
        sender_identity_id: senderIdentityId,
        content_type: 'text',
        text,
        metadata: withCorrelationMetadata({ source: 'gmail_pubsub', payload }, correlationId),
      },
    };
    nc.publish(NATS_SUBJECTS.inboundMessage(channel), jc.encode(envelope));
    return;
  }

  throw new Error(`Unknown email handler: ${handler}`);
}

async function logEmailEvent(
  pool: pg.Pool,
  subscriptionId: string,
  status: 'success' | 'error',
  payload: Record<string, unknown>,
  error?: string,
) {
  await pool.query(
    `INSERT INTO email_events (id, subscription_id, status, payload, error, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [uuidv7(), subscriptionId, status, JSON.stringify(payload || {}), error || null],
  );
}

async function getPushToken(pool: pg.Pool): Promise<string> {
  if (process.env.GMAIL_PUBSUB_TOKEN) return String(process.env.GMAIL_PUBSUB_TOKEN);
  const res = await pool.query(
    `SELECT value FROM settings_global WHERE key = 'gmail.pubsub.verification_token' LIMIT 1`,
  );
  if (res.rows.length === 0) return '';
  const val = res.rows[0]?.value;
  if (typeof val === 'string') {
    try {
      return String(JSON.parse(val));
    } catch {
      return val;
    }
  }
  return String(val || '');
}

function decodePubsubMessage(data?: string): Record<string, unknown> {
  if (!data) return {};
  try {
    const json = Buffer.from(String(data), 'base64').toString('utf8');
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

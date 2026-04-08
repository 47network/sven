import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection, StringCodec, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { AudioIngestEvent, EventEnvelope, InboundMessageEvent } from '@sven/shared';
import type { NotifyPushEvent } from '@sven/shared';
import { withCorrelationMetadata } from '../lib/correlation.js';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import { upsertChatMember } from './chat-members.js';

const logger = createLogger('gateway-adapter');
const sc = StringCodec();
const jc = JSONCodec();

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    const padded = Buffer.alloc(ab.length);
    bb.copy(padded);
    timingSafeEqual(ab, padded);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function normalizeAdapterBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

class PairingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairingUnavailableError';
  }
}

export async function registerAdapterRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  // Adapter token verification middleware
  const verifyAdapterToken = async (request: any, reply: any) => {
    const rawToken = request.headers['x-sven-adapter-token'];
    const providedToken =
      typeof rawToken === 'string'
        ? rawToken
        : Array.isArray(rawToken) && rawToken.length > 0
          ? String(rawToken[0])
          : '';
    if (!providedToken) {
      reply.status(401).send({
        success: false,
        error: { code: 'MISSING_ADAPTER_TOKEN', message: 'X-SVEN-ADAPTER-TOKEN required' },
      });
      return;
    }

    const expectedGlobalToken = String(process.env.SVEN_ADAPTER_TOKEN || '').trim();
    const bodyChannel = String(request?.body?.channel || '').trim();
    let expectedChannelToken = '';
    if (bodyChannel) {
      const channelTokenRow = await pool.query(
        `SELECT value
         FROM settings_global
         WHERE key = $1
         LIMIT 1`,
        [`adapter.${bodyChannel}.token`],
      );
      expectedChannelToken = String(channelTokenRow.rows[0]?.value || '').trim();
    }

    const tokenMatchesGlobal = expectedGlobalToken.length > 0 && safeEqual(providedToken, expectedGlobalToken);
    const tokenMatchesChannel = expectedChannelToken.length > 0 && safeEqual(providedToken, expectedChannelToken);
    if (!tokenMatchesGlobal && !tokenMatchesChannel) {
      reply.status(403).send({
        success: false,
        error: { code: 'INVALID_ADAPTER_TOKEN', message: 'Invalid adapter token' },
      });
      return;
    }
  };

  // ─── POST /v1/events/message ───
  app.post('/v1/events/message', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      channel: string;
      channel_message_id: string;
      chat_id: string;
      sender_identity_id: string;
      text: string;
      metadata?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    const eventId = uuidv7();
    const correlationId = request.correlationId || String(request.id || eventId);
    const context = await resolveInboundMessageContext(pool, body);
    if (!context.ok) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: context.message },
      });
      return;
    }

    const widgetBlock = await enforceWidgetIngressIfNeeded(pool, body.channel, context.chatId, body.metadata);
    if (widgetBlock) {
      return reply.status(widgetBlock.status).send(widgetBlock.body);
    }

    const routing = await resolveAgentRouting(pool, body.channel, context.chatId, context.senderIdentityId);
    const enrichedMetadata = withCorrelationMetadata({
      ...(body.metadata || {}),
      ...(routing.agent_id ? { agent_id: routing.agent_id } : {}),
      ...(routing.session_id ? { agent_session_id: routing.session_id } : {}),
      ...(routing.rule_id ? { routing_rule_id: routing.rule_id } : {}),
    }, correlationId);

    // Persist inbound message idempotently (webhook retries must not duplicate messages)
    const insertMessage = await pool.query(
      `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, text, channel_message_id, created_at)
       VALUES ($1, $2, $3, 'user', 'text', $4, $5, NOW())
       ON CONFLICT (chat_id, channel_message_id)
       WHERE channel_message_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [eventId, context.chatId, context.senderIdentityId, body.text, body.channel_message_id],
    );
    if (insertMessage.rowCount === 0) {
      const existing = await pool.query(
        `SELECT id FROM messages WHERE chat_id = $1 AND channel_message_id = $2 LIMIT 1`,
        [context.chatId, body.channel_message_id],
      );
      const duplicateMessageId = String(existing.rows[0]?.id || eventId);
      logger.info('Inbound message duplicate suppressed', {
        channel: body.channel,
        chat_id: context.chatId,
        channel_message_id: body.channel_message_id,
        message_id: duplicateMessageId,
        correlation_id: correlationId,
      });
      reply.status(202).send({ success: true, data: { event_id: duplicateMessageId, duplicate: true } });
      return;
    }

    // Publish to NATS
    const envelope: EventEnvelope<InboundMessageEvent> = {
      schema_version: '1.0',
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      data: {
        channel: body.channel,
        channel_message_id: body.channel_message_id,
        chat_id: context.chatId,
        sender_identity_id: context.senderIdentityId,
        content_type: 'text',
        text: body.text,
        metadata: enrichedMetadata,
      },
    };

    nc.publish(NATS_SUBJECTS.inboundMessage(body.channel), jc.encode(envelope));

    logger.info('Inbound message received', {
      event_id: eventId,
      channel: body.channel,
      chat_id: context.chatId,
      agent_id: routing.agent_id,
      correlation_id: correlationId,
    });

    reply.status(202).send({ success: true, data: { event_id: eventId } });
  });

  // ─── POST /v1/events/file ───
  app.post('/v1/events/file', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      channel: string;
      channel_message_id: string;
      chat_id: string;
      sender_identity_id: string;
      file_url: string;
      file_name: string;
      file_mime: string;
      text?: string;
      metadata?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    const eventId = uuidv7();
    const correlationId = request.correlationId || String(request.id || eventId);
    const widgetBlock = await enforceWidgetIngressIfNeeded(pool, body.channel, body.chat_id, body.metadata);
    if (widgetBlock) {
      return reply.status(widgetBlock.status).send(widgetBlock.body);
    }
    const routing = await resolveAgentRouting(pool, body.channel, body.chat_id, body.sender_identity_id);
    const enrichedMetadata = withCorrelationMetadata({
      ...(body.metadata || {}),
      ...(routing.agent_id ? { agent_id: routing.agent_id } : {}),
      ...(routing.session_id ? { agent_session_id: routing.session_id } : {}),
      ...(routing.rule_id ? { routing_rule_id: routing.rule_id } : {}),
    }, correlationId);

    const insertMessage = await pool.query(
      `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, text, channel_message_id, created_at)
       VALUES ($1, $2, $3, 'user', 'file', $4, $5, NOW())
       ON CONFLICT (chat_id, channel_message_id)
       WHERE channel_message_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [eventId, body.chat_id, body.sender_identity_id, body.text || '', body.channel_message_id],
    );
    if (insertMessage.rowCount === 0) {
      const existing = await pool.query(
        `SELECT id FROM messages WHERE chat_id = $1 AND channel_message_id = $2 LIMIT 1`,
        [body.chat_id, body.channel_message_id],
      );
      const duplicateMessageId = String(existing.rows[0]?.id || eventId);
      logger.info('Inbound file duplicate suppressed', {
        channel: body.channel,
        chat_id: body.chat_id,
        channel_message_id: body.channel_message_id,
        message_id: duplicateMessageId,
        correlation_id: correlationId,
      });
      reply.status(202).send({ success: true, data: { event_id: duplicateMessageId, duplicate: true } });
      return;
    }

    const envelope: EventEnvelope<InboundMessageEvent> = {
      schema_version: '1.0',
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      data: {
        channel: body.channel,
        channel_message_id: body.channel_message_id,
        chat_id: body.chat_id,
        sender_identity_id: body.sender_identity_id,
        content_type: 'file',
        text: body.text,
        file_url: body.file_url,
        file_name: body.file_name,
        file_mime: body.file_mime,
        metadata: enrichedMetadata,
      },
    };

    nc.publish(NATS_SUBJECTS.inboundMessage(body.channel), jc.encode(envelope));

    logger.info('Inbound file received', {
      event_id: eventId,
      channel: body.channel,
      agent_id: routing.agent_id,
      correlation_id: correlationId,
    });
    reply.status(202).send({ success: true, data: { event_id: eventId } });
  });

  // ─── POST /v1/events/audio ───
  app.post('/v1/events/audio', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      channel: string;
      channel_message_id: string;
      chat_id: string;
      sender_identity_id: string;
      audio_url: string;
      audio_mime?: string;
      metadata?: Record<string, unknown>;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    const eventId = uuidv7();
    const correlationId = request.correlationId || String(request.id || eventId);
    const widgetBlock = await enforceWidgetIngressIfNeeded(pool, body.channel, body.chat_id, body.metadata);
    if (widgetBlock) {
      return reply.status(widgetBlock.status).send(widgetBlock.body);
    }
    const routing = await resolveAgentRouting(pool, body.channel, body.chat_id, body.sender_identity_id);
    const metadata: Record<string, unknown> = withCorrelationMetadata({
      ...(body.metadata || {}),
      ...(routing.agent_id ? { agent_id: routing.agent_id } : {}),
      ...(routing.session_id ? { agent_session_id: routing.session_id } : {}),
      ...(routing.rule_id ? { routing_rule_id: routing.rule_id } : {}),
    }, correlationId);
    const shouldTranscribe = (metadata as any).transcribe !== false;

    const insertMessage = await pool.query(
      `INSERT INTO messages (id, chat_id, sender_identity_id, role, content_type, audio_url, channel_message_id, created_at)
       VALUES ($1, $2, $3, 'user', 'audio', $4, $5, NOW())
       ON CONFLICT (chat_id, channel_message_id)
       WHERE channel_message_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [eventId, body.chat_id, body.sender_identity_id, body.audio_url, body.channel_message_id],
    );
    if (insertMessage.rowCount === 0) {
      const existing = await pool.query(
        `SELECT id FROM messages WHERE chat_id = $1 AND channel_message_id = $2 LIMIT 1`,
        [body.chat_id, body.channel_message_id],
      );
      const duplicateMessageId = String(existing.rows[0]?.id || eventId);
      logger.info('Inbound audio duplicate suppressed', {
        channel: body.channel,
        chat_id: body.chat_id,
        channel_message_id: body.channel_message_id,
        message_id: duplicateMessageId,
        correlation_id: correlationId,
      });
      reply.status(202).send({ success: true, data: { event_id: duplicateMessageId, duplicate: true } });
      return;
    }

    if (shouldTranscribe) {
      const audioEnvelope: EventEnvelope<AudioIngestEvent> = {
        schema_version: '1.0',
        event_id: eventId,
        occurred_at: new Date().toISOString(),
        data: {
          channel: body.channel,
          channel_message_id: body.channel_message_id,
          chat_id: body.chat_id,
          sender_identity_id: body.sender_identity_id,
          message_id: eventId,
          audio_url: body.audio_url,
          audio_mime: body.audio_mime,
          metadata,
        },
      };

      nc.publish(NATS_SUBJECTS.AUDIO_INGEST, jc.encode(audioEnvelope));
      logger.info('Inbound audio queued for STT', {
        event_id: eventId,
        channel: body.channel,
        correlation_id: correlationId,
      });
    } else {
      const envelope: EventEnvelope<InboundMessageEvent> = {
        schema_version: '1.0',
        event_id: eventId,
        occurred_at: new Date().toISOString(),
        data: {
          channel: body.channel,
          channel_message_id: body.channel_message_id,
          chat_id: body.chat_id,
          sender_identity_id: body.sender_identity_id,
          content_type: 'audio',
          audio_url: body.audio_url,
          metadata,
        },
      };

      nc.publish(NATS_SUBJECTS.inboundMessage(body.channel), jc.encode(envelope));
      logger.info('Inbound audio forwarded without transcription', {
        event_id: eventId,
        channel: body.channel,
        correlation_id: correlationId,
      });
    }

    reply.status(202).send({ success: true, data: { event_id: eventId } });
  });

  // ─── POST /v1/adapter/identity/resolve ───
  // Adapters call this to find-or-create an identity + user for a channel user
  app.post('/v1/adapter/identity/resolve', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      channel: string;
      channel_user_id: string;
      display_name?: string;
      organization_id?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const headerOrgId = String(request.headers['x-sven-org-id'] || '').trim();
    const bodyOrgId = String(body.organization_id || '').trim();
    if (headerOrgId && bodyOrgId && headerOrgId !== bodyOrgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'organization_id conflicts with X-SVEN-ORG-ID' },
      });
    }
    const organizationId = bodyOrgId || headerOrgId;
    if (!organizationId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'organization_id or X-SVEN-ORG-ID is required' },
      });
    }

    // Try to find existing identity
    const existing = await pool.query(
      `SELECT id, user_id FROM identities WHERE channel = $1 AND channel_user_id = $2`,
      [body.channel, body.channel_user_id],
    );

    if (existing.rows.length > 0) {
      // Update display_name if changed
      if (body.display_name) {
        await pool.query(
          `UPDATE identities SET display_name = $1 WHERE id = $2`,
          [body.display_name, existing.rows[0].id],
        );
      }
      reply.send({
        success: true,
        data: { identity_id: existing.rows[0].id, user_id: existing.rows[0].user_id },
      });
      return;
    }

    const blocked = await isSenderBlocked(pool, organizationId, body.channel, body.channel_user_id);
    if (blocked) {
      reply.status(403).send({
        success: false,
        error: { code: 'DM_BLOCKED', message: 'Sender is blocked for this channel' },
      });
      return;
    }

    const dmPolicy = await getDmPolicy(pool, organizationId, body.channel);
    if (dmPolicy === 'deny') {
      reply.status(403).send({
        success: false,
        error: { code: 'DM_DENIED', message: 'DM policy denies unknown senders' },
      });
      return;
    }

    if (dmPolicy === 'pairing') {
      const allowlisted = await isSenderAllowlisted(pool, organizationId, body.channel, body.channel_user_id);
      if (!allowlisted) {
        const ttlSeconds = await getPairingTtlSeconds(pool, organizationId, body.channel);
        let pairing: { code: string; expires_at: string };
        try {
          pairing = await getOrCreatePairingRequest(
            pool,
            nc,
            organizationId,
            body.channel,
            body.channel_user_id,
            ttlSeconds,
          );
        } catch (err) {
          if (err instanceof PairingUnavailableError) {
            logger.warn('Pairing unavailable for identity resolve', {
              channel: body.channel,
              channel_user_id: body.channel_user_id,
            });
            reply.status(503).send({
              success: false,
              error: {
                code: 'PAIRING_UNAVAILABLE',
                message: 'Pairing is temporarily unavailable',
              },
            });
            return;
          }
          throw err;
        }
        reply.status(202).send({
          success: true,
          data: {
            requires_pairing: true,
            code: pairing.code,
            expires_at: pairing.expires_at,
          },
        });
        return;
      }
    }

    // Try transparent cross-channel identity link before creating a fresh user.
    const linkedUserId = await resolveAutoLinkedUserId(
      pool,
      body.channel,
      body.channel_user_id,
      body.display_name,
    );

    // Create new user + identity
    const userId = linkedUserId || uuidv7();
    const identityId = uuidv7();
    const displayName = body.display_name || `${body.channel}:${body.channel_user_id}`;

    if (!linkedUserId) {
      const randomPassword = randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);
      await pool.query(
        `INSERT INTO users (id, username, display_name, role, password_hash, created_at)
         VALUES ($1, $2, $3, 'user', $4, NOW())
         ON CONFLICT DO NOTHING`,
        [userId, `${body.channel}_${body.channel_user_id}`, displayName, passwordHash],
      );
    }

    await pool.query(
      `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [identityId, userId, body.channel, body.channel_user_id, displayName],
    );

    logger.info('Created new identity', {
      identity_id: identityId,
      user_id: userId,
      channel: body.channel,
      channel_user_id: body.channel_user_id,
      auto_linked: Boolean(linkedUserId),
    });

    reply.send({
      success: true,
      data: { identity_id: identityId, user_id: userId },
    });
  });

  // ─── POST /v1/adapter/identity-link/confirm ───
  // Adapters can call this when a user confirms account linking from a claimed channel.
  app.post('/v1/adapter/identity-link/confirm', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const body = request.body as {
      channel: string;
      channel_user_id: string;
      code: string;
      display_name?: string;
    };
    const channel = String(body.channel || '').trim().toLowerCase();
    const channelUserId = String(body.channel_user_id || '').trim();
    const code = String(body.code || '').trim();
    if (!channel || !channelUserId || !code) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'channel, channel_user_id, and code are required' },
      });
      return;
    }

    const linkRes = await pool.query(
      `UPDATE identity_links
       SET verified = true, verified_at = NOW(), verification_code = NULL, verification_expires_at = NULL, updated_at = NOW()
       WHERE channel_type = $1
         AND channel_user_id = $2
         AND verified = false
         AND verification_code = $3
         AND (verification_expires_at IS NULL OR verification_expires_at > NOW())
       RETURNING id, user_id, channel_type, channel_user_id, verified, linked_at, verified_at`,
      [channel, channelUserId, code],
    );
    if (linkRes.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'INVALID_CODE', message: 'No pending identity link matches this code' },
      });
      return;
    }
    const link = linkRes.rows[0];

    const existingIdentity = await pool.query(
      `SELECT id, user_id FROM identities WHERE channel = $1 AND channel_user_id = $2 LIMIT 1`,
      [channel, channelUserId],
    );
    if (existingIdentity.rows.length > 0) {
      if (String(existingIdentity.rows[0].user_id) !== String(link.user_id)) {
        await pool.query(
          `UPDATE identities
           SET user_id = $1, display_name = COALESCE($2, display_name), linked_at = NOW()
           WHERE id = $3`,
          [link.user_id, body.display_name || null, existingIdentity.rows[0].id],
        );
      }
      reply.send({
        success: true,
        data: {
          link_id: link.id,
          user_id: link.user_id,
          identity_id: existingIdentity.rows[0].id,
          verified: true,
        },
      });
      return;
    }

    const identityId = uuidv7();
    const displayName = body.display_name || `${channel}:${channelUserId}`;
    await pool.query(
      `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [identityId, link.user_id, channel, channelUserId, displayName],
    );

    reply.send({
      success: true,
      data: {
        link_id: link.id,
        user_id: link.user_id,
        identity_id: identityId,
        verified: true,
      },
    });
  });

  // ─── POST /v1/adapter/chat/resolve ───
  // Adapters call this to find-or-create a chat for a channel conversation
  app.post('/v1/adapter/chat/resolve', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      channel: string;
      channel_chat_id: string;
      organization_id?: string;
      name?: string;
      type?: 'dm' | 'group';
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const headerOrgId = String((request.headers as Record<string, unknown>)['x-sven-org-id'] || '').trim();
    const bodyOrgId = String(body.organization_id || '').trim();
    if (headerOrgId && bodyOrgId && headerOrgId !== bodyOrgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'organization_id conflicts with X-SVEN-ORG-ID' },
      });
    }
    const organizationId = bodyOrgId || headerOrgId;
    if (!organizationId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'organization_id or X-SVEN-ORG-ID is required' },
      });
    }

    const existing = await pool.query(
      `SELECT id FROM chats WHERE channel = $1 AND channel_chat_id = $2 AND organization_id = $3`,
      [body.channel, body.channel_chat_id, organizationId],
    );

    if (existing.rows.length > 0) {
      reply.send({ success: true, data: { chat_id: existing.rows[0].id } });
      return;
    }

    const chatId = uuidv7();
    await pool.query(
      `INSERT INTO chats (id, organization_id, name, type, channel, channel_chat_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [chatId, organizationId, body.name || `${body.channel} chat`, body.type || 'group', body.channel, body.channel_chat_id],
    );

    logger.info('Created new chat', {
      chat_id: chatId,
      organization_id: organizationId,
      channel: body.channel,
      channel_chat_id: body.channel_chat_id,
    });

    reply.send({ success: true, data: { chat_id: chatId } });
  });

  // ─── POST /v1/adapter/chat/ensure-member ───
  // Adapters call this to ensure a user is a member of a chat
  app.post('/v1/adapter/chat/ensure-member', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{ chat_id: string; user_id: string }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;

    await upsertChatMember(pool, { chatId: body.chat_id, userId: body.user_id, role: 'member' });

    reply.send({ success: true });
  });

  // ─── POST /v1/adapter/approval/verify ───
  // Adapter-side approval gate for high-risk channel actions (e.g. outbound voice calls)
  app.post('/v1/adapter/approval/verify', { preHandler: verifyAdapterToken }, async (request, reply) => {
    const bodyParsed = normalizeAdapterBody<{
      approval_id?: string;
      chat_id?: string;
      tool_name?: string;
      scope?: string;
      organization_id?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const body = bodyParsed.value;
    const approvalId = String(body.approval_id || '').trim();
    const chatId = String(body.chat_id || '').trim();
    const toolName = String(body.tool_name || '').trim();
    const scope = String(body.scope || '').trim();
    const headerOrgId = String((request.headers as Record<string, unknown>)['x-sven-org-id'] || '').trim();
    const bodyOrgId = String(body.organization_id || '').trim();
    if (headerOrgId && bodyOrgId && headerOrgId !== bodyOrgId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'organization_id conflicts with X-SVEN-ORG-ID' },
      });
      return;
    }
    const orgId = bodyOrgId || headerOrgId;

    if (!approvalId || !chatId || !toolName || !scope) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'approval_id, chat_id, tool_name, and scope are required' },
      });
      return;
    }
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'organization_id or X-SVEN-ORG-ID is required' },
      });
      return;
    }

    const res = await pool.query(
      `SELECT a.id, a.chat_id, a.tool_name, a.scope, a.status, a.expires_at, a.resolved_at
       FROM approvals a
       JOIN chats c ON c.id = a.chat_id
       WHERE a.id = $1
         AND a.chat_id = $2
         AND c.organization_id = $3
       LIMIT 1`,
      [approvalId, chatId, orgId],
    );
    if (res.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Approval not found' },
      });
      return;
    }

    const row = res.rows[0];
    const now = Date.now();
    const expiresAtMs = row.expires_at ? Date.parse(String(row.expires_at)) : NaN;
    const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < now;
    const toolMatches = String(row.tool_name || '') === toolName;
    const scopeMatches = String(row.scope || '') === scope;
    const approved = String(row.status) === 'approved' && !isExpired && toolMatches && scopeMatches;

    reply.send({
      success: true,
      data: {
        approval_id: row.id,
        chat_id: row.chat_id,
        approved,
        status: row.status,
        tool_name: row.tool_name,
        scope: row.scope,
        expires_at: row.expires_at,
        resolved_at: row.resolved_at,
        matches: {
          tool_name: toolMatches,
          scope: scopeMatches,
        },
      },
    });
  });
}

type InboundMessageBody = {
  channel: string;
  chat_id: string;
  sender_identity_id: string;
  metadata?: Record<string, unknown>;
};

async function resolveInboundMessageContext(
  pool: pg.Pool,
  body: InboundMessageBody,
): Promise<{ ok: true; chatId: string; senderIdentityId: string } | { ok: false; message: string }> {
  const chatId = String(body.chat_id || '').trim();
  const senderIdentityId = String(body.sender_identity_id || '').trim();
  if (chatId && senderIdentityId) {
    const bindingRes = await pool.query(
      `SELECT c.id
       FROM chats c
       JOIN identities i ON i.id = $2
       WHERE c.id = $1
         AND c.channel = $3
         AND i.channel = $3
         AND EXISTS (
           SELECT 1
           FROM chat_members cm
           WHERE cm.chat_id = c.id
             AND cm.user_id = i.user_id
         )
       LIMIT 1`,
      [chatId, senderIdentityId, String(body.channel || '').trim()],
    );
    if (!bindingRes.rows.length) {
      return { ok: false, message: 'sender_identity_id is not bound to chat_id for this channel' };
    }
    return { ok: true, chatId, senderIdentityId };
  }

  const metadata = (body.metadata && typeof body.metadata === 'object') ? body.metadata : {};
  const isApprovalVote = metadata.is_approval_vote === true;
  if (!isApprovalVote) {
    return { ok: false, message: 'chat_id and sender_identity_id are required' };
  }

  const approvalId = String(metadata.approval_id || '').trim();
  if (!approvalId) {
    return { ok: false, message: 'approval vote requires metadata.approval_id' };
  }

  const voterChannelUserId = resolveApprovalVoterChannelUserId(body.channel, metadata);
  if (!voterChannelUserId) {
    return { ok: false, message: 'approval vote requires voter channel identity in metadata' };
  }

  const approvalRes = await pool.query(
    `SELECT chat_id FROM approvals WHERE id = $1 LIMIT 1`,
    [approvalId],
  );
  if (!approvalRes.rows.length) {
    return { ok: false, message: 'approval vote references unknown approval_id' };
  }

  const identityRes = await pool.query(
    `SELECT id FROM identities WHERE channel = $1 AND channel_user_id = $2 LIMIT 1`,
    [String(body.channel || '').trim(), voterChannelUserId],
  );
  if (!identityRes.rows.length) {
    return { ok: false, message: 'approval vote voter identity not found for channel' };
  }

  return {
    ok: true,
    chatId: chatId || String(approvalRes.rows[0].chat_id || '').trim(),
    senderIdentityId: senderIdentityId || String(identityRes.rows[0].id || '').trim(),
  };
}

function resolveApprovalVoterChannelUserId(channel: string, metadata: Record<string, unknown>): string {
  const normalizedChannel = String(channel || '').trim().toLowerCase();
  const candidateByChannel: Record<string, string> = {
    discord: String(metadata.voter_discord_id || ''),
    slack: String(metadata.voter_slack_id || ''),
    telegram: String(metadata.voter_telegram_id || ''),
    whatsapp: String(metadata.voter_whatsapp_id || ''),
  };
  const channelCandidate = candidateByChannel[normalizedChannel];
  if (channelCandidate && channelCandidate.trim()) return channelCandidate.trim();
  return String(metadata.voter_channel_user_id || '').trim();
}

async function validateAndConsumeWidgetRateLimit(
  pool: pg.Pool,
  chatId: string,
  widgetApiKey: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    const chatRes = await pool.query(
      `SELECT organization_id
       FROM chats
       WHERE id = $1
       LIMIT 1`,
      [chatId],
    );
    const orgId = String(chatRes.rows[0]?.organization_id || '').trim();
    if (!orgId) {
      return { ok: false, code: 'WIDGET_ORG_NOT_FOUND', message: 'Widget chat organization not found' };
    }

    const instanceRes = await pool.query(
      `SELECT id, rate_limit_rpm, enabled, api_key_hash
       FROM web_widget_instances
       WHERE organization_id = $1
       LIMIT 250`,
      [orgId],
    );
    if (!instanceRes.rows.length) {
      return { ok: false, code: 'WIDGET_KEY_INVALID', message: 'Invalid widget API key' };
    }

    const legacySha256 = createHash('sha256').update(widgetApiKey).digest('hex');
    let matchedRow: any | null = null;
    let matchedLegacySha = false;
    for (const row of instanceRes.rows) {
      if (!row?.enabled) continue;
      const storedHash = String(row?.api_key_hash || '');
      if (!storedHash) continue;
      if (storedHash.startsWith('$2')) {
        const ok = await bcrypt.compare(widgetApiKey, storedHash);
        if (ok) {
          matchedRow = row;
          break;
        }
        continue;
      }
      if (storedHash === legacySha256) {
        matchedRow = row;
        matchedLegacySha = true;
        break;
      }
    }

    if (!matchedRow) {
      return { ok: false, code: 'WIDGET_KEY_INVALID', message: 'Invalid widget API key' };
    }
    if (!matchedRow?.enabled) {
      return { ok: false, code: 'WIDGET_DISABLED', message: 'Widget instance disabled' };
    }
    if (matchedLegacySha) {
      try {
        const upgradedHash = await bcrypt.hash(widgetApiKey, 12);
        await pool.query(
          `UPDATE web_widget_instances
           SET api_key_hash = $1, updated_at = NOW()
           WHERE id = $2`,
          [upgradedHash, String(matchedRow.id)],
        );
      } catch {
        // Best-effort hash upgrade; do not fail auth if migration write fails.
      }
    }

    const instanceId = String(matchedRow.id);
    const rpm = Number(matchedRow.rate_limit_rpm || 60);
    const rateRes = await pool.query(
      `WITH upsert AS (
         INSERT INTO web_widget_rate_limits (instance_id, window_start, count, updated_at)
         VALUES ($1, date_trunc('minute', NOW()), 1, NOW())
         ON CONFLICT (instance_id, window_start)
         DO UPDATE SET count = web_widget_rate_limits.count + 1, updated_at = NOW()
         RETURNING count
       )
       SELECT count::int AS count FROM upsert`,
      [instanceId],
    );
    const count = Number(rateRes.rows[0]?.count || 0);
    if (count > rpm) {
      return { ok: false, code: 'WIDGET_RATE_LIMITED', message: 'Widget instance rate limit exceeded' };
    }
    return { ok: true };
  } catch (err) {
    const code = String((err as any)?.code || '');
    if (code === '42P01' || code === '42703') {
      return {
        ok: false,
        code: 'WIDGET_GUARD_UNAVAILABLE',
        message: 'Widget ingress policy is unavailable',
      };
    }
    throw err;
  }
}

async function enforceWidgetIngressIfNeeded(
  pool: pg.Pool,
  channel: string,
  chatId: string,
  metadata?: Record<string, unknown>,
): Promise<{ status: number; body: { success: false; error: { code: string; message: string } } } | null> {
  if (String(channel || '').trim().toLowerCase() !== 'webchat') {
    return null;
  }
  const requireWidgetKey = String(process.env.WIDGET_INGRESS_REQUIRE_KEY || 'true').trim().toLowerCase() !== 'false';
  const widgetKey = String((metadata as any)?.widget_instance_key || '').trim();
  if (!widgetKey) {
    if (!requireWidgetKey) return null;
    return {
      status: 403,
      body: {
        success: false,
        error: { code: 'WIDGET_KEY_REQUIRED', message: 'widget_instance_key is required for webchat ingress' },
      },
    };
  }
  const widgetCheck = await validateAndConsumeWidgetRateLimit(pool, chatId, widgetKey);
  if (widgetCheck.ok) {
    return null;
  }
  const status = widgetCheck.code === 'WIDGET_RATE_LIMITED'
    ? 429
    : widgetCheck.code === 'WIDGET_GUARD_UNAVAILABLE'
      ? 503
      : 403;
  return {
    status,
    body: {
      success: false,
      error: { code: widgetCheck.code, message: widgetCheck.message },
    },
  };
}

async function resolveAutoLinkedUserId(
  pool: pg.Pool,
  channel: string,
  channelUserId: string,
  _displayName?: string,
): Promise<string | null> {
  try {
    const enabledRes = await pool.query(
      `SELECT value FROM settings_global WHERE key = 'identity.auto_link_enabled' LIMIT 1`,
    );
    if (enabledRes.rows.length > 0) {
      const raw = parseSetting(enabledRes.rows[0].value);
      const enabled = typeof raw === 'boolean'
        ? raw
        : String(raw || '').toLowerCase() === 'true';
      if (!enabled) return null;
    }

    const explicitLink = await pool.query(
      `SELECT user_id
       FROM identity_links
       WHERE channel_type = $1
         AND channel_user_id = $2
         AND verified = true
       ORDER BY linked_at DESC
       LIMIT 1`,
      [channel, channelUserId],
    );
    if (explicitLink.rows.length > 0) {
      return String(explicitLink.rows[0].user_id);
    }
  } catch {
    // Ignore linkage errors and fall back to creating a new user.
  }

  return null;
}

async function getDmPolicy(pool: pg.Pool, organizationId: string, channel: string): Promise<'pairing' | 'open' | 'deny'> {
  const key = `adapter.${channel}.dm.policy`;
  const res = await pool.query(
    `SELECT value FROM organization_settings WHERE organization_id = $1 AND key = $2 LIMIT 1`,
    [organizationId, key],
  );
  if (res.rows.length === 0) return 'pairing';
  const val = String(parseSetting(res.rows[0].value) || 'pairing').toLowerCase();
  if (val === 'open' || val === 'deny' || val === 'pairing') return val;
  return 'pairing';
}

async function getPairingTtlSeconds(pool: pg.Pool, organizationId: string, channel: string): Promise<number> {
  const key = `adapter.${channel}.dm.pairing_ttl_seconds`;
  const res = await pool.query(
    `SELECT value FROM organization_settings WHERE organization_id = $1 AND key = $2 LIMIT 1`,
    [organizationId, key],
  );
  if (res.rows.length === 0) return 300;
  const val = Number(parseSetting(res.rows[0].value) || 300);
  if (!Number.isFinite(val) || val <= 0) return 300;
  return Math.max(1, Math.min(3600, Math.floor(val)));
}

type PairingStorageCapabilities = {
  pairingRequestsOrgScoped: boolean;
  allowlistsOrgScoped: boolean;
  denylistsOrgScoped: boolean;
};

const pairingStorageCapabilitiesCache = new WeakMap<pg.Pool, Promise<PairingStorageCapabilities>>();

async function detectPairingStorageCapabilities(pool: pg.Pool): Promise<PairingStorageCapabilities> {
  const cached = pairingStorageCapabilitiesCache.get(pool);
  if (cached) return cached;
  const loading = (async () => {
    try {
      const res = await pool.query(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('pairing_requests', 'channel_allowlists', 'channel_denylists')
            AND column_name = 'organization_id'`,
      );
      const keys = new Set(
        (res.rows || []).map((row) => `${String(row.table_name || '')}.${String(row.column_name || '')}`),
      );
      return {
        pairingRequestsOrgScoped: keys.has('pairing_requests.organization_id'),
        allowlistsOrgScoped: keys.has('channel_allowlists.organization_id'),
        denylistsOrgScoped: keys.has('channel_denylists.organization_id'),
      };
    } catch {
      return {
        pairingRequestsOrgScoped: true,
        allowlistsOrgScoped: true,
        denylistsOrgScoped: true,
      };
    }
  })();
  pairingStorageCapabilitiesCache.set(pool, loading);
  return loading;
}

async function isSenderAllowlisted(pool: pg.Pool, organizationId: string, channel: string, senderId: string): Promise<boolean> {
  try {
    const schema = await detectPairingStorageCapabilities(pool);
    const res = schema.allowlistsOrgScoped
      ? await pool.query(
          `SELECT id
           FROM channel_allowlists
           WHERE organization_id = $1
             AND channel = $2
             AND sender_id IN ($3, '*')
           LIMIT 1`,
          [organizationId, channel, senderId],
        )
      : await pool.query(
          `SELECT id
           FROM channel_allowlists
           WHERE channel = $1
             AND sender_id IN ($2, '*')
           LIMIT 1`,
          [channel, senderId],
        );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

async function isSenderBlocked(pool: pg.Pool, organizationId: string, channel: string, senderId: string): Promise<boolean> {
  try {
    const schema = await detectPairingStorageCapabilities(pool);
    const res = schema.denylistsOrgScoped
      ? await pool.query(
          `SELECT id
           FROM channel_denylists
           WHERE organization_id = $1
             AND channel = $2
             AND sender_id IN ($3, '*')
           LIMIT 1`,
          [organizationId, channel, senderId],
        )
      : await pool.query(
          `SELECT id
           FROM channel_denylists
           WHERE channel = $1
             AND sender_id IN ($2, '*')
           LIMIT 1`,
          [channel, senderId],
        );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

async function getOrCreatePairingRequest(
  pool: pg.Pool,
  nc: NatsConnection,
  organizationId: string,
  channel: string,
  senderId: string,
  ttlSeconds: number,
): Promise<{ code: string; expires_at: string }> {
  try {
    const schema = await detectPairingStorageCapabilities(pool);
    const scopedWhere = schema.pairingRequestsOrgScoped
      ? `organization_id = $1
         AND channel = $2
         AND sender_id = $3`
      : `channel = $1
         AND sender_id = $2`;
    const scopedParams = schema.pairingRequestsOrgScoped
      ? [organizationId, channel, senderId]
      : [channel, senderId];

    await pool.query(
      `UPDATE pairing_requests
       SET status = 'expired'
       WHERE ${scopedWhere}
         AND status = 'pending'
         AND expires_at <= NOW()`,
      scopedParams,
    );

    const existing = await pool.query(
      `SELECT code, expires_at
       FROM pairing_requests
       WHERE ${scopedWhere}
         AND status = 'pending'
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      scopedParams,
    );
    if (existing.rows.length > 0) {
      return {
        code: String(existing.rows[0].code),
        expires_at: new Date(existing.rows[0].expires_at).toISOString(),
      };
    }

    const previous = await pool.query(
      `SELECT code
       FROM pairing_requests
       WHERE ${scopedWhere}
       ORDER BY created_at DESC
       LIMIT 1`,
      scopedParams,
    );
    const previousCode = previous.rows.length > 0 ? String(previous.rows[0].code) : '';
    const code = generatePairingCode(previousCode);
    const requestId = uuidv7();
    const inserted = schema.pairingRequestsOrgScoped
      ? await pool.query(
          `INSERT INTO pairing_requests (id, organization_id, channel, sender_id, code, status, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW() + ($6 || ' seconds')::interval)
           RETURNING expires_at`,
          [requestId, organizationId, channel, senderId, code, String(ttlSeconds)],
        )
      : await pool.query(
          `INSERT INTO pairing_requests (id, channel, sender_id, code, status, created_at, expires_at)
           VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW() + ($5 || ' seconds')::interval)
           RETURNING expires_at`,
          [requestId, channel, senderId, code, String(ttlSeconds)],
        );

    const notifyEnvelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'pairing.pending',
        channel: 'outbox',
        title: `Pairing request: ${channel}`,
        body: `Sender "${senderId}" requested DM access. Approve code: ${code}`,
        data: {
          pairing_request_id: requestId,
          pairing_channel: channel,
          sender_id: senderId,
          code,
          expires_at: new Date(inserted.rows[0].expires_at).toISOString(),
          commands: {
            approve: `sven pairing approve ${channel} ${code}`,
            deny: `sven pairing deny ${channel} ${code}`,
          },
        },
        priority: 'high',
      },
    };
    nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(notifyEnvelope));

    return {
      code,
      expires_at: new Date(inserted.rows[0].expires_at).toISOString(),
    };
  } catch (err) {
    const code = String((err as any)?.code || '');
    if (code === '42P01' || code === '42703') {
      throw new PairingUnavailableError('Pairing schema is not ready');
    }
    throw new PairingUnavailableError('Pairing storage failed');
  }
}

function parseSetting(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function generatePairingCode(previousCode: string): string {
  for (let i = 0; i < 5; i += 1) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    if (candidate !== previousCode) {
      return candidate;
    }
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeChannel(input: string): string {
  return input.trim().toLowerCase();
}

async function resolveAgentRouting(
  pool: pg.Pool,
  channel: string,
  chatId: string,
  senderIdentityId: string,
): Promise<{ agent_id?: string; session_id?: string; rule_id?: string }> {
  try {
    const normalizedChannel = normalizeChannel(channel);
    const [chatRes, identityRes] = await Promise.all([
      pool.query(`SELECT channel_chat_id FROM chats WHERE id = $1`, [chatId]),
      pool.query(`SELECT user_id FROM identities WHERE id = $1`, [senderIdentityId]),
    ]);
    const channelChatId = String(chatRes.rows[0]?.channel_chat_id || '');
    const userId = identityRes.rows[0]?.user_id || null;

    const ruleRes = await pool.query(
      `SELECT id, agent_id, session_id
       FROM agent_routing_rules
       WHERE enabled = true
         AND lower(channel) = $1
         AND (channel_chat_id IS NULL OR channel_chat_id = $2)
         AND (user_id IS NULL OR user_id = $3)
         AND (sender_identity_id IS NULL OR sender_identity_id = $4)
       ORDER BY priority DESC, created_at DESC
       LIMIT 1`,
      [normalizedChannel, channelChatId, userId, senderIdentityId],
    );

    if (ruleRes.rows.length === 0) {
      return {};
    }

    return {
      rule_id: ruleRes.rows[0].id,
      agent_id: ruleRes.rows[0].agent_id,
      session_id: ruleRes.rows[0].session_id || undefined,
    };
  } catch {
    return {};
  }
}

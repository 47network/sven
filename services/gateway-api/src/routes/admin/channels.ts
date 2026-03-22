/**
 * Admin API — Channel / Adapter Management
 *
 * Provides endpoints for managing adapter tokens, viewing adapter status,
 * and configuring channel settings from the Admin UI.
 */

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-channels');

function toJsonSettingValue(value: unknown): string {
  if (value === undefined) return 'null';
  return JSON.stringify(value);
}

function normalizeChannelsBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

const CHANNEL_CONFIG_SENSITIVE_KEY_PATTERN = /(token|secret|password|private.?key|api.?key|credential)/i;

function isSensitiveChannelConfigKey(key: string): boolean {
  return CHANNEL_CONFIG_SENSITIVE_KEY_PATTERN.test(key);
}

function sanitizeChannelConfig(rawConfig: Record<string, unknown>): {
  config: Record<string, unknown>;
  configured: boolean;
  has_token: boolean;
} {
  const config: Record<string, unknown> = {};
  let hasToken = false;
  const entries = Object.entries(rawConfig);
  for (const [key, value] of entries) {
    if (isSensitiveChannelConfigKey(key)) {
      if (key.toLowerCase().includes('token') && String(value ?? '').trim().length > 0) {
        hasToken = true;
      }
      continue;
    }
    config[key] = value;
  }
  return {
    config,
    configured: entries.length > 0,
    has_token: hasToken,
  };
}

export async function registerChannelRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  requireRole: (pool: pg.Pool, ...roles: string[]) => any,
) {
  const adminOnly = requireRole(pool, 'admin');

  // ─── GET /channels — List configured adapters ───
  app.get('/channels', { preHandler: adminOnly }, async (_request, reply) => {
    // Adapter configuration stored in settings_global
    const { rows: settings } = await pool.query(
      `SELECT key, value FROM settings_global WHERE key LIKE 'adapter.%' ORDER BY key`,
    );

    // Aggregate channel stats
    const { rows: stats } = await pool.query(`
      SELECT
        channel,
        COUNT(DISTINCT id) AS chat_count,
        (SELECT COUNT(*) FROM identities WHERE identities.channel = c.channel) AS identity_count,
        (SELECT COUNT(*) FROM messages m JOIN chats ch ON m.chat_id = ch.id WHERE ch.channel = c.channel) AS message_count
      FROM chats c
      WHERE channel IS NOT NULL AND channel != ''
      GROUP BY channel
      ORDER BY channel
    `);

    // Known adapter types with their capabilities
    const adapterMeta: Record<string, { buttons: boolean; files: boolean; audio: boolean; threads: boolean }> = {
      discord:     { buttons: true,  files: true,  audio: true,  threads: true },
      slack:       { buttons: true,  files: true,  audio: false, threads: true },
      telegram:    { buttons: true,  files: true,  audio: true,  threads: false },
      teams:       { buttons: true,  files: true,  audio: false, threads: false },
      google_chat: { buttons: true,  files: true,  audio: false, threads: true },
      whatsapp:    { buttons: true,  files: true,  audio: true,  threads: false },
      signal:      { buttons: false, files: false, audio: false, threads: false },
      imessage:    { buttons: false, files: false, audio: false, threads: false },
      webchat:     { buttons: true,  files: true,  audio: true,  threads: false },
    };

    const channels = Object.entries(adapterMeta).map(([channel, caps]) => {
      const channelSettings = settings
        .filter((s: any) => s.key.startsWith(`adapter.${channel}.`))
        .reduce((acc: any, s: any) => {
          const key = s.key.replace(`adapter.${channel}.`, '');
          acc[key] = s.value;
          return acc;
        }, {});
      const sanitized = sanitizeChannelConfig(channelSettings);

      const stat = stats.find((s: any) => s.channel === channel);

      return {
        channel,
        enabled: channelSettings.enabled === 'true' || channelSettings.enabled === true,
        configured: sanitized.configured,
        has_token: sanitized.has_token,
        capabilities: caps,
        stats: {
          chats: parseInt(stat?.chat_count || '0'),
          identities: parseInt(stat?.identity_count || '0'),
          messages: parseInt(stat?.message_count || '0'),
        },
        config: sanitized.config,
      };
    });

    reply.send({ success: true, data: { channels } });
  });

  // ─── GET /channels/:channel — Get adapter detail ───
  app.get('/channels/:channel', { preHandler: adminOnly }, async (request, reply) => {
    const { channel } = request.params as { channel: string };

    const { rows: settings } = await pool.query(
      `SELECT key, value FROM settings_global WHERE key LIKE $1`,
      [`adapter.${channel}.%`],
    );

    const rawConfig = settings.reduce((acc: any, s: any) => {
      const key = s.key.replace(`adapter.${channel}.`, '');
      acc[key] = s.value;
      return acc;
    }, {});
    const sanitizedConfig = sanitizeChannelConfig(rawConfig);

    // Recent identities on this channel
    const { rows: identities } = await pool.query(
      `SELECT i.id, i.user_id, i.channel_user_id, i.display_name, i.linked_at,
              u.username, u.display_name as user_display_name
       FROM identities i
       LEFT JOIN users u ON i.user_id = u.id
       WHERE i.channel = $1
       ORDER BY i.linked_at DESC
       LIMIT 50`,
      [channel],
    );

    // Recent chats on this channel
    const { rows: chats } = await pool.query(
      `SELECT id, name, type, channel_chat_id, created_at
       FROM chats
       WHERE channel = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [channel],
    );

    reply.send({
      success: true,
      data: { channel, config: sanitizedConfig.config, configured: sanitizedConfig.configured, has_token: sanitizedConfig.has_token, identities, chats },
    });
  });

  // ─── PUT /channels/:channel — Update adapter config ───
  app.put('/channels/:channel', { preHandler: adminOnly }, async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const actorId = String((request as any).userId || '').trim();
    const bodyParsed = normalizeChannelsBody<Record<string, any>>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    if (!actorId) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authenticated actor is required' } });
      return;
    }
    const body = bodyParsed.value;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [key, value] of Object.entries(body)) {
        const settingKey = `adapter.${channel}.${key}`;
        await client.query(
          `INSERT INTO settings_global (key, value, updated_at, updated_by)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
          [settingKey, toJsonSettingValue(value), actorId],
        );
      }

      await client.query('COMMIT');

      logger.info('Adapter config updated', { channel, keys: Object.keys(body) });
      reply.send({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // ─── POST /channels/:channel/token — Rotate adapter token ───
  app.post('/channels/:channel/token', { preHandler: adminOnly }, async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const actorId = String((request as any).userId || '').trim();
    if (!actorId) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authenticated actor is required' } });
      return;
    }

    // Generate a new random token
    const crypto = await import('node:crypto');
    const newToken = crypto.randomBytes(32).toString('hex');

    await pool.query(
      `INSERT INTO settings_global (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
      [`adapter.${channel}.token`, toJsonSettingValue(newToken), actorId],
    );

    logger.info('Adapter token rotated', { channel });
    reply.send({ success: true, data: { token: newToken } });
  });

  // ─── DELETE /channels/:channel/identities/:id — Unlink identity ───
  app.delete('/channels/:channel/identities/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { channel, id } = request.params as { channel: string; id: string };

    const result = await pool.query(
      `DELETE FROM identities WHERE id = $1 AND channel = $2 RETURNING id`,
      [id, channel],
    );

    if (result.rowCount === 0) {
      reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Identity not found' } });
      return;
    }

    logger.info('Identity unlinked', { identity_id: id, channel });
    reply.send({ success: true });
  });

  // ─── POST /channels/:channel/identities/link — Link identity to user ───
  app.post('/channels/:channel/identities/link', { preHandler: adminOnly }, async (request, reply) => {
    const { channel } = request.params as { channel: string };
    const bodyParsed = normalizeChannelsBody<{
      user_id: string;
      channel_user_id: string;
      display_name?: string;
    }>(request.body);
    if (!bodyParsed.ok) {
      reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
      return;
    }
    const body = bodyParsed.value;
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    if (!orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const userId = String(body.user_id || '').trim();
    const channelUserId = String(body.channel_user_id || '').trim();
    if (!userId || !channelUserId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'user_id and channel_user_id are required' },
      });
      return;
    }
    const membership = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'
       LIMIT 1`,
      [orgId, userId],
    );
    if (membership.rowCount === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Target user is not active in this account' },
      });
      return;
    }
    const existing = await pool.query(
      `SELECT id, user_id
       FROM identities
       WHERE channel = $1 AND channel_user_id = $2
       LIMIT 1`,
      [channel, channelUserId],
    );
    if (existing.rowCount && String(existing.rows[0].user_id) !== userId) {
      reply.status(409).send({
        success: false,
        error: { code: 'IDENTITY_REBIND_FORBIDDEN', message: 'Identity is already linked to another user' },
      });
      return;
    }
    if (existing.rowCount && String(existing.rows[0].user_id) === userId) {
      await pool.query(
        `UPDATE identities
         SET display_name = $1, linked_at = NOW()
         WHERE id = $2`,
        [body.display_name || null, existing.rows[0].id],
      );
      reply.send({ success: true, data: { identity_id: existing.rows[0].id } });
      return;
    }

    const { v7: uuidv7 } = await import('uuid');
    const id = uuidv7();

    await pool.query(
      `INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, userId, channel, channelUserId, body.display_name || null],
    );

    logger.info('Identity linked', { identity_id: id, user_id: userId, channel });
    reply.send({ success: true, data: { identity_id: id } });
  });
}

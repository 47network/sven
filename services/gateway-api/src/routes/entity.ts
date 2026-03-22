/**
 * Entity Real-Time State Route — Server-Sent Events + REST
 * ═════════════════════════════════════════════════════════════════
 *
 * Endpoints:
 * - GET /v1/entity/stream?channel=<default|chatId> — SSE connection for entity state updates
 * - GET /v1/entity/state — Get current entity state (snapshot)
 * - GET /v1/entity/avatar — Get current entity form
 * - PATCH /v1/entity/avatar — Set/update entity form
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { entityStateService } from '../services/EntityStateService.js';
import { SvenEntityState, PredefinedForm, EntityForm, TypingIndicatorMode, TTSAmplitude } from '../types/entity.js';
import { requireRole } from './auth.js';

const logger = createLogger('entity-route');
const ENTITY_AVATAR_SETTING_KEY = 'entity.avatar.form';
const ENTITY_CHANNEL_PATTERN = /^[A-Za-z0-9:_-]{1,120}$/;

function currentUserId(request: any): string | null {
  const direct = String(request?.userId || '').trim();
  if (direct) return direct;
  const nested = String(request?.user?.id || '').trim();
  return nested || null;
}

function currentOrgId(request: any): string | null {
  const direct = String(request?.orgId || '').trim();
  return direct || null;
}

function normalizeRequestedEntityChannel(raw: unknown): string | null {
  const value = String(raw || '').trim();
  const channel = value || 'default';
  if (!ENTITY_CHANNEL_PATTERN.test(channel)) return null;
  return channel;
}

function scopedEntityChannel(orgId: string, userId: string): string {
  return `entity:${orgId}:${userId}`;
}

type EntityChannelResolution =
  | { ok: true; channelId: string; userId: string; orgId: string }
  | { ok: false; status: number; code: string; message: string };

function normalizeTypingIndicatorMode(raw: unknown): TypingIndicatorMode {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'never' || value === 'instant' || value === 'thinking' || value === 'message') {
    return value;
  }
  return 'thinking';
}

async function loadTypingIndicatorMode(pool: pg.Pool, orgId: string): Promise<TypingIndicatorMode> {
  const orgRes = await pool.query(
    `SELECT value
       FROM organization_settings
      WHERE organization_id = $1
        AND key = 'chat.typingIndicator.mode'
      LIMIT 1`,
    [orgId],
  );
  if (orgRes.rows.length > 0) {
    return normalizeTypingIndicatorMode(orgRes.rows[0].value);
  }
  const globalRes = await pool.query(
    `SELECT value
       FROM settings_global
      WHERE key = 'chat.typingIndicator.mode'
      LIMIT 1`,
  );
  if (globalRes.rows.length > 0) {
    return normalizeTypingIndicatorMode(globalRes.rows[0].value);
  }
  return 'thinking';
}

export async function resolveAuthorizedEntityChannel(
  pool: pg.Pool,
  request: FastifyRequest,
  requestedRaw: unknown,
): Promise<EntityChannelResolution> {
  const userId = currentUserId(request);
  if (!userId) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' };
  }
  const orgId = currentOrgId(request);
  if (!orgId) {
    return { ok: false, status: 403, code: 'ORG_REQUIRED', message: 'Active account required' };
  }
  const requestedChannel = normalizeRequestedEntityChannel(requestedRaw);
  if (!requestedChannel) {
    return { ok: false, status: 400, code: 'INVALID_CHANNEL', message: 'Invalid channel identifier' };
  }
  if (requestedChannel === 'default' || requestedChannel === 'entity') {
    return { ok: true, channelId: scopedEntityChannel(orgId, userId), userId, orgId };
  }

  const membership = await pool.query(
    `SELECT 1
       FROM chat_members cm
       JOIN chats c ON c.id = cm.chat_id
      WHERE cm.user_id = $1
        AND c.organization_id = $2
        AND (c.id::text = $3 OR c.channel = $3)
      LIMIT 1`,
    [userId, orgId, requestedChannel],
  );
  if (membership.rows.length === 0) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Channel is outside your authorized scope',
    };
  }

  return { ok: true, channelId: requestedChannel, userId, orgId };
}

function defaultEntityForm(): EntityForm {
  return {
    id: PredefinedForm.ORB,
    name: 'CORE',
    form: PredefinedForm.ORB,
  };
}

function normalizeEntityForm(raw: unknown): EntityForm {
  const candidate = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const allowed = new Set(['orb', 'aria', 'rex', 'orion', 'custom']);
  const formRaw = String(candidate.form || '').trim().toLowerCase();
  const form = allowed.has(formRaw) ? formRaw : PredefinedForm.ORB;
  const id = String(candidate.id || form || PredefinedForm.ORB).trim() || PredefinedForm.ORB;
  const name = String(candidate.name || '').trim() || (form === 'custom' ? 'CUSTOM' : form.toUpperCase());
  const spec = candidate.spec;

  return {
    id,
    name,
    form: (form as EntityForm['form']) || PredefinedForm.ORB,
    ...(spec !== undefined ? { spec } : {}),
  };
}

/**
 * Register entity routes and SSE handler
 */
export async function registerEntityRoutes(app: FastifyInstance, pool: pg.Pool) {
    const authenticated = requireRole(pool, 'user', 'admin');

    // ──────────────────────────────────────────────────────────────────────
    // SSE Stream: GET /v1/entity/stream?channel=<default|chatId>
    // Real-time entity state updates via Server-Sent Events
    // ──────────────────────────────────────────────────────────────────────

    app.get<{ Querystring: { channel?: string } }>(
        '/v1/entity/stream',
        { preHandler: authenticated },
        async (request: FastifyRequest<{ Querystring: { channel?: string } }>, reply: FastifyReply) => {
            const resolution = await resolveAuthorizedEntityChannel(pool, request, (request.query as Record<string, string>)?.channel);
            if (!resolution.ok) {
                return reply.status(resolution.status).send({
                    error: { code: resolution.code, message: resolution.message },
                });
            }
            const channelId = resolution.channelId;
            const typingMode = await loadTypingIndicatorMode(pool, resolution.orgId);

            // Initialize state for this channel if needed
            const initialState = entityStateService.initChannel(channelId);
            entityStateService.setTypingMode(channelId, typingMode);

            logger.debug('SSE client connected', { channelId });

            // Set SSE headers
            reply.hijack();
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });

            // Send initial state
            reply.raw.write(
                `data: ${JSON.stringify({
                    type: 'entity.state',
                    data: initialState,
                })}\n\n`
            );

            // Subscribe to entity state changes
            const unsubscribe = entityStateService.subscribe(
                channelId,
                (state: SvenEntityState) => {
                    try {
                        reply.raw.write(
                            `data: ${JSON.stringify({
                                type: 'entity.state',
                                data: state,
                            })}\n\n`
                        );
                    } catch (err) {
                        logger.debug('Failed to send state to SSE client', { error: String(err) });
                    }
                }
            );

            // Subscribe to TTS amplitude events
            const unsubscribeAmplitude = entityStateService.subscribeAmplitude(
                channelId,
                (amplitude: TTSAmplitude) => {
                    try {
                        reply.raw.write(
                            `data: ${JSON.stringify({
                                type: 'entity.tts.amplitude',
                                data: amplitude,
                            })}\n\n`
                        );
                    } catch (err) {
                        logger.debug('Failed to send amplitude to SSE client', { error: String(err) });
                    }
                }
            );

            const handleAvatarUpdated = (payload: { channelId: string; form: EntityForm }) => {
                if (payload.channelId !== channelId) return;
                try {
                    reply.raw.write(
                        `data: ${JSON.stringify({
                            type: 'entity.avatar.updated',
                            data: payload,
                        })}\n\n`
                    );
                } catch (err) {
                    logger.debug('Failed to send avatar update to SSE client', { error: String(err) });
                }
            };
            entityStateService.on('entity:avatar.updated', handleAvatarUpdated);

            // Cleanup on client disconnect
            let cleanedUp = false;
            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                unsubscribe();
                unsubscribeAmplitude();
                entityStateService.off('entity:avatar.updated', handleAvatarUpdated);
                logger.debug('SSE client disconnected', { channelId });
            };

            reply.raw.on('error', (err: Error) => {
                logger.warn('SSE stream error', { channelId, error: String(err) });
                cleanup();
            });

            // Keep connection alive with heartbeat
            const heartbeatInterval = setInterval(() => {
                try {
                    reply.raw.write(': heartbeat\n\n');
                } catch (err) {
                    clearInterval(heartbeatInterval);
                    unsubscribe();
                    unsubscribeAmplitude();
                }
            }, 30_000);

            reply.raw.on('close', () => {
                clearInterval(heartbeatInterval);
            });
            request.raw.on('close', () => {
                clearInterval(heartbeatInterval);
                cleanup();
            });
        }
    );

    // ──────────────────────────────────────────────────────────────────────
    // HTTP REST: GET /v1/entity/state — get current entity state (snapshot)
    // ──────────────────────────────────────────────────────────────────────

    app.get<{ Querystring: { channel?: string } }>(
        '/v1/entity/state',
        { preHandler: authenticated },
        async (request, reply) => {
            const resolution = await resolveAuthorizedEntityChannel(pool, request, request.query?.channel);
            if (!resolution.ok) {
                return reply.status(resolution.status).send({
                    error: { code: resolution.code, message: resolution.message },
                });
            }
            const channelId = resolution.channelId;
            const typingMode = await loadTypingIndicatorMode(pool, resolution.orgId);
            const state = entityStateService.getState(channelId);

            if (!state) {
                // Initialize and return default state
                const initialState = entityStateService.initChannel(channelId);
                entityStateService.setTypingMode(channelId, typingMode);
                return reply.send(initialState);
            }
            entityStateService.setTypingMode(channelId, typingMode);

            return reply.send(state);
        }
    );

    // ──────────────────────────────────────────────────────────────────────
    // HTTP REST: GET /v1/entity/avatar — get current entity form
    // ──────────────────────────────────────────────────────────────────────

    app.get<{ Querystring: { channel?: string } }>(
        '/v1/entity/avatar',
        { preHandler: authenticated },
        async (request, reply) => {
            const resolution = await resolveAuthorizedEntityChannel(pool, request, request.query?.channel);
            if (!resolution.ok) {
                return reply.status(resolution.status).send({
                    error: { code: resolution.code, message: resolution.message },
                });
            }
            const { userId, orgId, channelId } = resolution;
            try {
                const result = await pool.query(
                    `SELECT value
                     FROM user_settings
                     WHERE user_id = $1 AND organization_id = $2 AND key = $3
                     LIMIT 1`,
                    [userId, orgId, ENTITY_AVATAR_SETTING_KEY],
                ).catch(async (err) => {
                    if (String((err as { code?: string })?.code || '') !== '42P01') throw err;
                    await pool.query(
                        `CREATE TABLE IF NOT EXISTS user_settings (
                           user_id text NOT NULL,
                           organization_id text NOT NULL,
                           key text NOT NULL,
                           value jsonb NOT NULL DEFAULT '{}'::jsonb,
                           updated_at timestamptz NOT NULL DEFAULT now(),
                           updated_by text NULL,
                           PRIMARY KEY (user_id, organization_id, key)
                         )`,
                    );
                    return pool.query(
                        `SELECT value
                         FROM user_settings
                         WHERE user_id = $1 AND organization_id = $2 AND key = $3
                         LIMIT 1`,
                        [userId, orgId, ENTITY_AVATAR_SETTING_KEY],
                    );
                });
                const persisted = result.rows[0]?.value as Record<string, unknown> | undefined;
                const form = persisted?.form ? normalizeEntityForm(persisted.form) : defaultEntityForm();

                entityStateService.initChannel(channelId);
                return reply.send({ form });
            } catch (err) {
                logger.error('Failed to load entity avatar form', { error: String(err), userId, orgId, channelId });
                return reply.status(500).send({
                    error: { code: 'INTERNAL_ERROR', message: 'Failed to load entity avatar form' },
                });
            }
        }
    );

    // ──────────────────────────────────────────────────────────────────────
    // HTTP REST: PATCH /v1/entity/avatar — set/update entity form
    // ──────────────────────────────────────────────────────────────────────

    app.patch<{ Body: { form?: string; spec?: unknown }; Querystring: { channel?: string } }>(
        '/v1/entity/avatar',
        { preHandler: authenticated },
        async (request, reply) => {
            const resolution = await resolveAuthorizedEntityChannel(pool, request, request.query?.channel);
            if (!resolution.ok) {
                return reply.status(resolution.status).send({
                    error: { code: resolution.code, message: resolution.message },
                });
            }
            const { userId, orgId, channelId } = resolution;
            const { form, spec } = request.body || {};

            // Validate form
            if (form && !['orb', 'aria', 'rex', 'orion', 'custom'].includes(form)) {
                return reply.status(400).send({
                    error: {
                        code: 'INVALID_FORM',
                        message: 'Form must be one of: orb, aria, rex, orion, custom',
                    },
                });
            }

            const normalizedForm = normalizeEntityForm({
                id: form || PredefinedForm.ORB,
                name: form?.toUpperCase() || 'CORE',
                form: form || 'orb',
                ...(spec !== undefined ? { spec } : {}),
            });

            try {
                await pool.query(
                    `INSERT INTO user_settings (user_id, organization_id, key, value, updated_at, updated_by)
                     VALUES ($1, $2, $3, $4::jsonb, NOW(), $1)
                     ON CONFLICT (user_id, organization_id, key)
                     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
                    [userId, orgId, ENTITY_AVATAR_SETTING_KEY, JSON.stringify({ form: normalizedForm })],
                ).catch(async (err) => {
                    if (String((err as { code?: string })?.code || '') !== '42P01') throw err;
                    await pool.query(
                        `CREATE TABLE IF NOT EXISTS user_settings (
                           user_id text NOT NULL,
                           organization_id text NOT NULL,
                           key text NOT NULL,
                           value jsonb NOT NULL DEFAULT '{}'::jsonb,
                           updated_at timestamptz NOT NULL DEFAULT now(),
                           updated_by text NULL,
                           PRIMARY KEY (user_id, organization_id, key)
                         )`,
                    );
                    await pool.query(
                        `INSERT INTO user_settings (user_id, organization_id, key, value, updated_at, updated_by)
                         VALUES ($1, $2, $3, $4::jsonb, NOW(), $1)
                         ON CONFLICT (user_id, organization_id, key)
                         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
                        [userId, orgId, ENTITY_AVATAR_SETTING_KEY, JSON.stringify({ form: normalizedForm })],
                    );
                });
            } catch (err) {
                logger.error('Failed to persist entity avatar form', { error: String(err), userId, orgId, channelId });
                return reply.status(500).send({
                    error: { code: 'INTERNAL_ERROR', message: 'Failed to save entity avatar form' },
                });
            }

            // Initialize channel state if needed
            entityStateService.initChannel(channelId);
            entityStateService.emit('entity:avatar.updated', { channelId, form: normalizedForm });

            return reply.send({
                success: true,
                form: normalizedForm,
            });
        }
    );

    logger.info('Entity routes registered');
}

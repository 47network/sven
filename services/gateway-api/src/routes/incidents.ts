import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection, JSONCodec } from 'nats';
import { v7 as uuidv7 } from 'uuid';
import { createLogger, NATS_SUBJECTS } from '@sven/shared';
import type { EventEnvelope, NotifyPushEvent } from '@sven/shared';
import { requireRole } from './auth.js';
import {
  activateKillSwitch,
  deactivateKillSwitch,
  enableLockdown,
  disableLockdown,
  enableForensics,
  disableForensics,
  getIncidentStatus,
} from '../services/IncidentService.js';

const logger = createLogger('gateway-incidents');
const jc = JSONCodec();

function normalizeIncidentBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function deriveModeFromStatus(status: {
  killSwitchActive: boolean;
  lockdownActive: boolean;
  forensicsActive: boolean;
}): 'kill_switch' | 'lockdown' | 'forensics' | 'normal' {
  if (status.killSwitchActive) return 'kill_switch';
  if (status.lockdownActive) return 'lockdown';
  if (status.forensicsActive) return 'forensics';
  return 'normal';
}

export async function registerIncidentRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
) {
  const adminOnly = requireRole(pool, 'admin');

  async function notifyAdmins(mode: string, enabled: boolean) {
    const hqRes = await pool.query(`SELECT id FROM chats WHERE type = 'hq' LIMIT 1`);
    const hqChatId = hqRes.rows[0]?.id || null;

    const admins = await pool.query(`SELECT id FROM users WHERE role = 'admin'`);
    const adminIds = admins.rows.map((r: any) => r.id);
    if (adminIds.length === 0) return;

    const envelope: EventEnvelope<NotifyPushEvent> = {
      schema_version: '1.0',
      event_id: uuidv7(),
      occurred_at: new Date().toISOString(),
      data: {
        type: 'incident',
        target_user_ids: adminIds,
        channel: 'outbox',
        title: `Incident mode ${enabled ? 'enabled' : 'disabled'}: ${mode}`,
        body: `Incident mode switched to ${mode}.`,
        priority: 'critical',
        data: { mode, enabled, chat_id: hqChatId },
        action_url: '/admin/incidents',
      },
    };

    nc.publish(NATS_SUBJECTS.NOTIFY_PUSH, jc.encode(envelope));
  }

  // ─── GET /v1/incidents/status ───
  app.get('/v1/incidents/status', { preHandler: adminOnly }, async (_request, reply) => {
    const status = await getIncidentStatus();
    const mode = deriveModeFromStatus(status);
    reply.send({ success: true, data: { mode } });
  });

  // ─── POST /v1/incidents/kill-switch ───
  app.post('/v1/incidents/kill-switch', { preHandler: adminOnly }, async (request, reply) => {
    const bodyParsed = normalizeIncidentBody<{ enabled?: unknown }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const { enabled } = bodyParsed.value;
    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean' },
      });
    }
    if (enabled) {
      await activateKillSwitch(String((request as any).userId || ''), 'v1 incident kill-switch toggle');
    } else {
      try {
        await deactivateKillSwitch(String((request as any).userId || ''));
      } catch (error) {
        if (String((error as any)?.code || '') !== 'INVALID_STATE') throw error;
      }
    }
    const mode = deriveModeFromStatus(await getIncidentStatus());

    logger.warn('Kill switch toggled', { enabled, by: (request as any).userId });
    await notifyAdmins(mode, enabled);
    reply.send({ success: true, data: { mode } });
  });

  // ─── POST /v1/incidents/lockdown ───
  app.post('/v1/incidents/lockdown', { preHandler: adminOnly }, async (request, reply) => {
    const bodyParsed = normalizeIncidentBody<{ enabled?: unknown }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const { enabled } = bodyParsed.value;
    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean' },
      });
    }
    if (enabled) {
      await enableLockdown(String((request as any).userId || ''), 'v1 incident lockdown toggle');
    } else {
      try {
        await disableLockdown(String((request as any).userId || ''));
      } catch (error) {
        if (String((error as any)?.code || '') !== 'INVALID_STATE') throw error;
      }
    }
    const mode = deriveModeFromStatus(await getIncidentStatus());

    logger.warn('Lockdown toggled', { enabled, by: (request as any).userId });
    await notifyAdmins(mode, enabled);
    reply.send({ success: true, data: { mode } });
  });

  // ─── POST /v1/incidents/forensics ───
  app.post('/v1/incidents/forensics', { preHandler: adminOnly }, async (request, reply) => {
    const bodyParsed = normalizeIncidentBody<{ enabled?: unknown }>(request.body);
    if (!bodyParsed.ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: bodyParsed.message },
      });
    }
    const { enabled } = bodyParsed.value;
    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean' },
      });
    }
    if (enabled) {
      await enableForensics(String((request as any).userId || ''), 'v1 incident forensics toggle');
    } else {
      try {
        await disableForensics(String((request as any).userId || ''));
      } catch (error) {
        if (String((error as any)?.code || '') !== 'INVALID_STATE') throw error;
      }
    }
    const mode = deriveModeFromStatus(await getIncidentStatus());

    logger.warn('Forensics mode toggled', { enabled, by: (request as any).userId });
    await notifyAdmins(mode, enabled);
    reply.send({ success: true, data: { mode } });
  });
}

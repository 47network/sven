import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireRole } from './auth.js';

const VISUAL_MODES = new Set(['classic', 'cinematic']);
const MOTION_LEVELS = new Set(['off', 'reduced', 'full']);
const AVATAR_MODES = new Set(['orb', 'robot', 'human', 'animal']);

function normalizeString(value: unknown) {
  return String(value || '').trim();
}

function toDefaults() {
  return {
    visual_mode: 'cinematic',
    motion_enabled: true,
    motion_level: 'full',
    avatar_mode: 'orb',
  };
}

function normalizeFeatureFlagValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  return String(value);
}

export async function registerUiPreferencesRoutes(app: FastifyInstance, pool: pg.Pool) {
  const requireAuth = requireRole(pool, 'admin', 'user');

  app.get('/v1/me/ui-preferences', { preHandler: requireAuth }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    if (!userId || !orgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active organization is required' },
      });
    }

    const result = await pool.query(
      `SELECT visual_mode, motion_enabled, motion_level, avatar_mode
       FROM user_ui_preferences
       WHERE user_id = $1
         AND organization_id = $2`,
      [userId, orgId],
    );
    const row = result.rows[0];
    const orgFeatureRows = await pool.query(
      `SELECT key, value
       FROM organization_settings
       WHERE organization_id = $1
         AND key LIKE 'feature.%'`,
      [orgId],
    );
    const userFeatureRows = await pool.query(
      `SELECT key, value
       FROM user_settings
       WHERE user_id = $1
         AND organization_id = $2
         AND key LIKE 'feature.%'`,
      [userId, orgId],
    );
    const featureFlags: Record<string, unknown> = {};
    for (const item of orgFeatureRows.rows) {
      const key = normalizeString(item.key);
      if (!key.startsWith('feature.')) continue;
      featureFlags[key] = normalizeFeatureFlagValue(item.value);
    }
    for (const item of userFeatureRows.rows) {
      const key = normalizeString(item.key);
      if (!key.startsWith('feature.')) continue;
      featureFlags[key] = normalizeFeatureFlagValue(item.value);
    }

    reply.send({
      success: true,
      data: {
        ...(row || toDefaults()),
        ...featureFlags,
      },
    });
  });

  app.put('/v1/me/ui-preferences', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          visual_mode: { type: 'string', enum: ['classic', 'cinematic'] },
          motion_enabled: { type: 'boolean' },
          motion_level: { type: 'string', enum: ['off', 'reduced', 'full'] },
          avatar_mode: { type: 'string', enum: ['orb', 'robot', 'human', 'animal'] },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    if (!userId || !orgId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active organization is required' },
      });
    }

    const body = (request.body || {}) as {
      visual_mode?: string;
      motion_enabled?: boolean;
      motion_level?: string;
      avatar_mode?: string;
    };

    const incoming = {
      visual_mode: body.visual_mode ? normalizeString(body.visual_mode) : undefined,
      motion_enabled: typeof body.motion_enabled === 'boolean' ? body.motion_enabled : undefined,
      motion_level: body.motion_level ? normalizeString(body.motion_level) : undefined,
      avatar_mode: body.avatar_mode ? normalizeString(body.avatar_mode) : undefined,
    };

    if (incoming.visual_mode && !VISUAL_MODES.has(incoming.visual_mode)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'visual_mode is invalid' },
      });
    }
    if (incoming.motion_level && !MOTION_LEVELS.has(incoming.motion_level)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'motion_level is invalid' },
      });
    }
    if (incoming.avatar_mode && !AVATAR_MODES.has(incoming.avatar_mode)) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'avatar_mode is invalid' },
      });
    }

    const currentRes = await pool.query(
      `SELECT visual_mode, motion_enabled, motion_level, avatar_mode
       FROM user_ui_preferences
       WHERE user_id = $1
         AND organization_id = $2`,
      [userId, orgId],
    );
    const current = currentRes.rows[0] || toDefaults();

    const visualMode = incoming.visual_mode ?? current.visual_mode;
    const avatarMode = incoming.avatar_mode ?? current.avatar_mode;
    const motionLevel = incoming.motion_level ?? current.motion_level;
    const motionEnabled =
      typeof incoming.motion_enabled === 'boolean'
        ? incoming.motion_enabled
        : motionLevel !== 'off';

    await pool.query(
      `INSERT INTO user_ui_preferences (user_id, organization_id, visual_mode, motion_enabled, motion_level, avatar_mode, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET
         visual_mode = EXCLUDED.visual_mode,
         motion_enabled = EXCLUDED.motion_enabled,
         motion_level = EXCLUDED.motion_level,
         avatar_mode = EXCLUDED.avatar_mode,
         updated_at = NOW()`,
      [userId, orgId, visualMode, motionEnabled, motionLevel, avatarMode],
    );

    reply.send({
      success: true,
      data: {
        visual_mode: visualMode,
        motion_enabled: motionEnabled,
        motion_level: motionLevel,
        avatar_mode: avatarMode,
      },
    });
  });
}

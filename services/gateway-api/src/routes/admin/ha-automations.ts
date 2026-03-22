import { FastifyInstance } from 'fastify';
import pg from 'pg';

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '').trim() === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
  });
  return false;
}

function currentOrgId(request: any): string | null {
  const orgId = String(request.orgId || '').trim();
  return orgId || null;
}

function requireActiveOrg(request: any, reply: any): string | null {
  const orgId = currentOrgId(request);
  if (orgId) return orgId;
  reply.status(403).send({
    success: false,
    error: { code: 'ORG_REQUIRED', message: 'Active account required' },
  });
  return null;
}

const haAutomationOrgScopeCache = new WeakMap<pg.Pool, Promise<boolean>>();

async function haAutomationsAreOrgScoped(pool: pg.Pool): Promise<boolean> {
  let cached = haAutomationOrgScopeCache.get(pool);
  if (!cached) {
    cached = (async () => {
      const res = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ha_automations'
            AND column_name = 'organization_id'
          LIMIT 1`,
      );
      return res.rows.length > 0;
    })();
    haAutomationOrgScopeCache.set(pool, cached);
  }
  return cached;
}

export async function registerHaAutomationRoutes(app: FastifyInstance, pool: pg.Pool) {
  // ─── GET /ha/automations ───
  app.get('/ha/automations', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const orgScoped = await haAutomationsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `SELECT a.id, a.name, a.description, a.chat_id, a.user_id, a.enabled, a.trigger, a.conditions, a.actions,
                  a.cooldown_seconds, a.last_state, a.last_attributes, a.last_triggered_at, a.created_at, a.updated_at
             FROM ha_automations a
            WHERE a.organization_id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = a.chat_id
                   AND c.organization_id = $1
              )
            ORDER BY a.created_at DESC`
        : `SELECT a.id, a.name, a.description, a.chat_id, a.user_id, a.enabled, a.trigger, a.conditions, a.actions,
                  a.cooldown_seconds, a.last_state, a.last_attributes, a.last_triggered_at, a.created_at, a.updated_at
             FROM ha_automations a
            WHERE EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = a.chat_id
                   AND c.organization_id = $1
              )
            ORDER BY a.created_at DESC`,
      [orgId],
    );

    reply.send({ success: true, data: result.rows });
  });

  // ─── POST /ha/automations ───
  app.post('/ha/automations', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const body = request.body as {
      name?: string;
      description?: string;
      chat_id?: string;
      user_id?: string;
      enabled?: boolean;
      trigger?: Record<string, unknown>;
      conditions?: Array<Record<string, unknown>>;
      actions?: Array<Record<string, unknown>>;
      cooldown_seconds?: number;
    } | null;

    if (!body?.name || !body.chat_id) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name and chat_id are required' },
      });
      return;
    }
    const chat = await pool.query(
      `SELECT 1
       FROM chats
       WHERE id = $1
         AND organization_id = $2
       LIMIT 1`,
      [body.chat_id, orgId],
    );
    if (chat.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat not found in active account' },
      });
      return;
    }

    const cooldown = typeof body.cooldown_seconds === 'number'
      ? Math.min(Math.max(body.cooldown_seconds, 0), 86400)
      : 0;

    const orgScoped = await haAutomationsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `INSERT INTO ha_automations (
              id, organization_id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
              cooldown_seconds, created_at, updated_at
           ) VALUES (
              uuid_generate_v4()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
           )
           RETURNING id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
                     cooldown_seconds, last_state, last_attributes, last_triggered_at, created_at, updated_at`
        : `INSERT INTO ha_automations (
              id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
              cooldown_seconds, created_at, updated_at
           ) VALUES (
              uuid_generate_v4()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
           )
           RETURNING id, name, description, chat_id, user_id, enabled, trigger, conditions, actions,
                     cooldown_seconds, last_state, last_attributes, last_triggered_at, created_at, updated_at`,
      orgScoped
        ? [
            orgId,
            body.name.trim(),
            body.description?.trim() ?? '',
            body.chat_id,
            body.user_id ?? null,
            body.enabled ?? true,
            JSON.stringify(body.trigger ?? {}),
            JSON.stringify(body.conditions ?? []),
            JSON.stringify(body.actions ?? []),
            cooldown,
          ]
        : [
            body.name.trim(),
            body.description?.trim() ?? '',
            body.chat_id,
            body.user_id ?? null,
            body.enabled ?? true,
            JSON.stringify(body.trigger ?? {}),
            JSON.stringify(body.conditions ?? []),
            JSON.stringify(body.actions ?? []),
            cooldown,
          ],
    );

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── PUT /ha/automations/:id ───
  app.put('/ha/automations/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      enabled?: boolean;
      trigger?: Record<string, unknown>;
      conditions?: Array<Record<string, unknown>>;
      actions?: Array<Record<string, unknown>>;
      cooldown_seconds?: number;
    } | null;

    const bodyRecord = (body && typeof body === 'object') ? (body as Record<string, unknown>) : null;
    const hasName = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'name'));
    const hasDescription = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'description'));
    const hasEnabled = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'enabled'));
    const hasTrigger = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'trigger'));
    const hasConditions = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'conditions'));
    const hasActions = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'actions'));
    const hasCooldown = Boolean(bodyRecord && Object.prototype.hasOwnProperty.call(bodyRecord, 'cooldown_seconds'));

    if (!hasName && !hasDescription && !hasEnabled && !hasTrigger && !hasConditions && !hasActions && !hasCooldown) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'At least one mutable field is required' },
      });
      return;
    }
    const orgScoped = await haAutomationsAreOrgScoped(pool);
    const current = await pool.query(
      orgScoped
        ? `SELECT a.id, a.name, a.description, a.enabled, a.trigger, a.conditions, a.actions, a.cooldown_seconds
             FROM ha_automations a
            WHERE a.id = $1
              AND a.organization_id = $2
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = a.chat_id
                   AND c.organization_id = $2
              )
            LIMIT 1`
        : `SELECT a.id, a.name, a.description, a.enabled, a.trigger, a.conditions, a.actions, a.cooldown_seconds
             FROM ha_automations a
            WHERE a.id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = a.chat_id
                   AND c.organization_id = $2
              )
            LIMIT 1`,
      [id, orgId],
    );
    if (current.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automation not found' },
      });
      return;
    }
    const row = current.rows[0] as Record<string, unknown>;

    const sets: string[] = [];
    const params: unknown[] = [id];

    if (hasName) {
      const next = String(body?.name || '').trim();
      if (next !== String(row.name || '')) {
        params.push(next);
        sets.push(`name = $${params.length}`);
      }
    }
    if (hasDescription) {
      const next = String(body?.description || '').trim();
      if (next !== String(row.description || '')) {
        params.push(next);
        sets.push(`description = $${params.length}`);
      }
    }
    if (hasEnabled) {
      if (typeof body?.enabled !== 'boolean') {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
        });
        return;
      }
      if (body.enabled !== row.enabled) {
        params.push(body.enabled);
        sets.push(`enabled = $${params.length}`);
      }
    }
    if (hasTrigger) {
      const next = JSON.stringify(body?.trigger ?? {});
      const curr = JSON.stringify((row.trigger as Record<string, unknown>) ?? {});
      if (next !== curr) {
        params.push(next);
        sets.push(`trigger = $${params.length}::jsonb`);
      }
    }
    if (hasConditions) {
      const next = JSON.stringify(body?.conditions ?? []);
      const curr = JSON.stringify((row.conditions as Array<Record<string, unknown>>) ?? []);
      if (next !== curr) {
        params.push(next);
        sets.push(`conditions = $${params.length}::jsonb`);
      }
    }
    if (hasActions) {
      const next = JSON.stringify(body?.actions ?? []);
      const curr = JSON.stringify((row.actions as Array<Record<string, unknown>>) ?? []);
      if (next !== curr) {
        params.push(next);
        sets.push(`actions = $${params.length}::jsonb`);
      }
    }
    if (hasCooldown) {
      if (typeof body?.cooldown_seconds !== 'number' || !Number.isFinite(body.cooldown_seconds)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'cooldown_seconds must be a finite number when provided' },
        });
        return;
      }
      const next = Math.min(Math.max(body.cooldown_seconds, 0), 86400);
      if (next !== Number(row.cooldown_seconds || 0)) {
        params.push(next);
        sets.push(`cooldown_seconds = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'No mutable changes supplied' },
      });
      return;
    }
    sets.push('updated_at = NOW()');

    const result = await pool.query(
      orgScoped
        ? `UPDATE ha_automations
             SET ${sets.join(', ')}
            WHERE ha_automations.id = $1
              AND ha_automations.organization_id = $${params.length + 1}
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = ha_automations.chat_id
                   AND c.organization_id = $${params.length + 1}
              )
            RETURNING ha_automations.id AS id,
                      ha_automations.name AS name,
                      ha_automations.description AS description,
                      ha_automations.chat_id AS chat_id,
                      ha_automations.user_id AS user_id,
                      ha_automations.enabled AS enabled,
                      ha_automations.trigger AS trigger,
                      ha_automations.conditions AS conditions,
                      ha_automations.actions AS actions,
                      ha_automations.cooldown_seconds AS cooldown_seconds,
                      ha_automations.last_state AS last_state,
                      ha_automations.last_attributes AS last_attributes,
                      ha_automations.last_triggered_at AS last_triggered_at,
                      ha_automations.created_at AS created_at,
                      ha_automations.updated_at AS updated_at`
        : `UPDATE ha_automations
             SET ${sets.join(', ')}
            WHERE ha_automations.id = $1
              AND EXISTS (
                SELECT 1
                  FROM chats c
                 WHERE c.id = ha_automations.chat_id
                   AND c.organization_id = $${params.length + 1}
              )
            RETURNING ha_automations.id AS id,
                      ha_automations.name AS name,
                      ha_automations.description AS description,
                      ha_automations.chat_id AS chat_id,
                      ha_automations.user_id AS user_id,
                      ha_automations.enabled AS enabled,
                      ha_automations.trigger AS trigger,
                      ha_automations.conditions AS conditions,
                      ha_automations.actions AS actions,
                      ha_automations.cooldown_seconds AS cooldown_seconds,
                      ha_automations.last_state AS last_state,
                      ha_automations.last_attributes AS last_attributes,
                      ha_automations.last_triggered_at AS last_triggered_at,
                      ha_automations.created_at AS created_at,
                      ha_automations.updated_at AS updated_at`,
      [...params, orgId],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automation not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  // ─── DELETE /ha/automations/:id ───
  app.delete('/ha/automations/:id', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = requireActiveOrg(request, reply);
    if (!orgId) return;
    const { id } = request.params as { id: string };

    const orgScoped = await haAutomationsAreOrgScoped(pool);
    const result = await pool.query(
      orgScoped
        ? `DELETE FROM ha_automations a
             USING chats c
            WHERE a.id = $1
              AND a.organization_id = $2
              AND c.id = a.chat_id
              AND c.organization_id = $2
            RETURNING a.id`
        : `DELETE FROM ha_automations a
             USING chats c
            WHERE a.id = $1
              AND c.id = a.chat_id
              AND c.organization_id = $2
            RETURNING a.id`,
      [id, orgId],
    );

    if (result.rows.length === 0) {
      reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Automation not found' },
      });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });
}

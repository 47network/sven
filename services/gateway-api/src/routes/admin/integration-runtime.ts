import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { IntegrationRuntimeOrchestrator } from '../../services/IntegrationRuntimeOrchestrator.js';
import { IntegrationRuntimeReconciler } from '../../services/IntegrationRuntimeReconciler.js';

const BOOT_EVENTS_DEFAULT_WINDOW_HOURS = 168;
const BOOT_EVENTS_MIN_WINDOW_HOURS = 1;
const BOOT_EVENTS_MAX_WINDOW_HOURS = 720;
const BOOT_EVENTS_DETAIL_MAX_CHARS = 800;
const BOOT_EVENTS_DETAIL_TRUNCATION_MARKER = '...[truncated]';
const SUPPORTED_INTEGRATION_RUNTIME_TYPES = new Set([
  'ha',
  'calendar',
  'git',
  'nas',
  'web',
  'frigate',
  'spotify',
  'sonos',
  'shazam',
  'obsidian',
  'notion',
  'apple-notes',
  'apple-reminders',
  'things3',
  'bear',
  'trello',
  'x',
  'onepassword',
  'weather',
  'gif',
  'device',
]);

function currentOrgId(request: any): string | null {
  return request.orgId ? String(request.orgId) : null;
}

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '').trim() === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
  });
  return false;
}

function normalizeIntegrationType(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function deriveStoragePath(orgId: string, integrationType: string): string {
  const root = String(process.env.SVEN_INTEGRATION_STORAGE_ROOT || '/var/lib/sven/integrations').replace(/[\\]+/g, '/').replace(/\/+$/, '');
  return `${root}/${orgId}/${integrationType}`;
}

function deriveNetworkScope(orgId: string): string {
  const digest = createHash('sha256').update(String(orgId || '').trim().toLowerCase()).digest('hex').slice(0, 24);
  return `sven-org-${digest || 'default'}`;
}

function isSafeImageRef(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (trimmed.length > 255) return false;
  if (/[\s`$|&;<>\\]/.test(trimmed)) return false;
  return /^[a-zA-Z0-9._:@/-]+$/.test(trimmed);
}

const SECRET_REF_ALLOWED_SCHEMES = new Set(['env', 'vault', 'sops']);
const SECRET_REF_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([A-Za-z0-9._/-]{1,160})$/;

function isValidSecretRef(value: string): boolean {
  const trimmed = String(value || '').trim();
  const match = SECRET_REF_PATTERN.exec(trimmed);
  if (!match) return false;
  return SECRET_REF_ALLOWED_SCHEMES.has(match[1].toLowerCase());
}

function secretRefScheme(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  const match = SECRET_REF_PATTERN.exec(trimmed);
  if (!match) return null;
  return match[1].toLowerCase();
}

function parseBootEventsWindowHours(raw: unknown): number {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed)) return BOOT_EVENTS_DEFAULT_WINDOW_HOURS;
  return Math.min(BOOT_EVENTS_MAX_WINDOW_HOURS, Math.max(BOOT_EVENTS_MIN_WINDOW_HOURS, parsed));
}

function parseBootEventsBeforeCursor(raw: unknown): Date | null {
  const value = String(raw || '').trim();
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoCursor(value: unknown): string | null {
  const parsed = new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function stripRestrictedAsciiControlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    const blocked = (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31);
    if (!blocked) out += ch;
  }
  return out;
}

function sanitizeBootEventDetail(value: unknown): string {
  const normalized = stripRestrictedAsciiControlChars(String(value || '').replace(/\r/g, '')).trim();
  if (normalized.length <= BOOT_EVENTS_DETAIL_MAX_CHARS) return normalized;
  const marker = BOOT_EVENTS_DETAIL_TRUNCATION_MARKER;
  if (BOOT_EVENTS_DETAIL_MAX_CHARS <= marker.length) return marker.slice(0, BOOT_EVENTS_DETAIL_MAX_CHARS);
  return `${normalized.slice(0, BOOT_EVENTS_DETAIL_MAX_CHARS - marker.length)}${marker}`;
}

function tenantSafeRuntimeError(raw: unknown, fallback: string): string {
  const value = String(raw || '').trim();
  if (!value) return fallback;
  if (value.startsWith('RUNTIME_CMD_TIMEOUT')) return 'Runtime command timed out';
  if (value.startsWith('No runtime command configured')) return 'Runtime hook is not configured';
  if (value.startsWith('Runtime command template')) return 'Runtime hook configuration is invalid';
  if (value.startsWith('Command exited with code')) return fallback;
  return fallback;
}

function sanitizeRuntimeInstanceRowForTenant(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    last_error:
      row.last_error === null || row.last_error === undefined || String(row.last_error).trim().length === 0
        ? null
        : tenantSafeRuntimeError(row.last_error, 'Runtime command failed'),
  };
}

function isSupportedIntegrationRuntimeType(value: string): boolean {
  return SUPPORTED_INTEGRATION_RUNTIME_TYPES.has(value);
}

function rejectUnsupportedIntegrationType(type: string, reply: any): true | false {
  if (isSupportedIntegrationRuntimeType(type)) return true;
  reply.status(400).send({
    success: false,
    error: { code: 'UNSUPPORTED_INTEGRATION_TYPE', message: 'integrationType is not supported by this build' },
  });
  return false;
}

export async function registerIntegrationRuntimeRoutes(app: FastifyInstance, pool: pg.Pool) {
  const orchestrator = new IntegrationRuntimeOrchestrator();
  const reconciler = new IntegrationRuntimeReconciler(pool, orchestrator);

  app.get('/integrations/runtime', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }

    const rows = await pool.query(
      `SELECT i.integration_type, i.runtime_mode, i.status, i.image_ref, i.storage_path, i.network_scope,
              i.deployment_spec, i.last_error, i.last_deployed_at, i.created_at, i.updated_at, c.config
       FROM integration_runtime_instances i
       LEFT JOIN integration_runtime_configs c
         ON c.organization_id = i.organization_id
        AND c.integration_type = i.integration_type
       WHERE i.organization_id = $1
       ORDER BY i.integration_type ASC`,
      [orgId],
    );
    return reply.send({
      success: true,
      data: rows.rows.map((row) => sanitizeRuntimeInstanceRowForTenant(row as Record<string, unknown>)),
    });
  });

  app.get('/integrations/runtime/boot-events', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const query = (request.query || {}) as {
      limit?: string | number;
      status?: string;
      integration_type?: string;
      chat_id?: string;
      window_hours?: string | number;
      before?: string;
    };
    const parsedLimit = Number(query.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(200, Math.max(1, Math.trunc(parsedLimit))) : 50;
    const status = String(query.status || '').trim().toLowerCase();
    const integrationType = normalizeIntegrationType(query.integration_type || '');
    const chatId = String(query.chat_id || '').trim();
    const windowHours = parseBootEventsWindowHours(query.window_hours);
    const beforeCursor = parseBootEventsBeforeCursor(query.before);
    if (!beforeCursor) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'before must be a valid ISO-8601 timestamp' },
      });
    }
    const sinceCursor = new Date(beforeCursor.getTime() - windowHours * 60 * 60 * 1000);

    const conditions = [
      `c.organization_id = $1`,
      `m.role = 'assistant'`,
      `b.content->>'type' = 'tool_card'`,
      `(b.content->'content'->>'tool_name') LIKE 'integration.runtime.%'`,
      `m.created_at >= $2`,
      `m.created_at < $3`,
    ];
    const params: Array<string | number> = [orgId, sinceCursor.toISOString(), beforeCursor.toISOString()];

    if (status) {
      params.push(status);
      conditions.push(`LOWER(COALESCE(b.content->'content'->>'status', '')) = $${params.length}`);
    }
    if (integrationType) {
      params.push(`integration.runtime.${integrationType}`);
      conditions.push(`LOWER(COALESCE(b.content->'content'->>'tool_name', '')) = $${params.length}`);
    }
    if (chatId) {
      params.push(chatId);
      conditions.push(`m.chat_id = $${params.length}`);
    }
    params.push(limit + 1);

    const rows = await pool.query(
      `SELECT m.id AS message_id,
              m.chat_id,
              m.created_at,
              b.content->'content'->>'tool_name' AS tool_name,
              b.content->'content'->>'status' AS status,
              COALESCE(
                b.content->'content'->>'error',
                b.content->'content'->'outputs'->>'message',
                ''
              ) AS detail
         FROM messages m
         JOIN chats c
           ON c.id = m.chat_id
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.blocks, '[]'::jsonb)) AS b(content)
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY m.created_at DESC
        LIMIT $${params.length}`,
      params,
    );

    const mapped = rows.rows.map((row) => ({
      message_id: String(row.message_id || ''),
      chat_id: String(row.chat_id || ''),
      created_at: row.created_at,
      tool_name: String(row.tool_name || ''),
      integration_type: String(row.tool_name || '').replace(/^integration\.runtime\./, ''),
      status: String(row.status || ''),
      detail: sanitizeBootEventDetail(row.detail),
    }));
    const hasMore = mapped.length > limit;
    const data = hasMore ? mapped.slice(0, limit) : mapped;
    const nextCursor = hasMore && data.length > 0 ? toIsoCursor(data[data.length - 1].created_at) : null;

    return reply.send({
      success: true,
      data,
      pagination: {
        window_hours: windowHours,
        before: beforeCursor.toISOString(),
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  });

  app.get('/integrations/runtime/:integrationType', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { integrationType } = request.params as { integrationType: string };
    const type = normalizeIntegrationType(integrationType);
    if (!type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'integrationType is required' } });
    }
    if (!rejectUnsupportedIntegrationType(type, reply)) return;

    const instance = await pool.query(
      `SELECT integration_type, runtime_mode, status, image_ref, storage_path, network_scope,
              deployment_spec, last_error, last_deployed_at, created_at, updated_at
       FROM integration_runtime_instances
       WHERE organization_id = $1 AND integration_type = $2
       LIMIT 1`,
      [orgId, type],
    );
    const config = await pool.query(
      `SELECT config FROM integration_runtime_configs
       WHERE organization_id = $1 AND integration_type = $2
       LIMIT 1`,
      [orgId, type],
    );
    const secretRefs = await pool.query(
      `SELECT secret_key, secret_ref, updated_at
       FROM integration_runtime_secret_refs
       WHERE organization_id = $1 AND integration_type = $2
       ORDER BY secret_key ASC`,
      [orgId, type],
    );

    const hooks = orchestrator.getHookReadiness(type);

    return reply.send({
      success: true,
      data: {
        integration_type: type,
        instance: instance.rows[0]
          ? sanitizeRuntimeInstanceRowForTenant(instance.rows[0] as Record<string, unknown>)
          : null,
        config: config.rows[0]?.config || {},
        secret_refs: secretRefs.rows.map((row) => ({
          secret_key: row.secret_key,
          updated_at: row.updated_at,
          secret_ref_present: true,
          secret_ref_scheme: secretRefScheme(row.secret_ref),
        })),
        runtime_hooks: hooks,
      },
    });
  });

  app.post('/integrations/runtime/reconcile', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    if (!requireGlobalAdmin(request, reply)) return;
    const report = await reconciler.reconcileOnce({ organizationId: orgId });
    if (report.skipped_due_to_lock) {
      return reply.status(409).send({
        success: false,
        error: { code: 'RECONCILE_IN_PROGRESS', message: 'Integration runtime reconcile already in progress' },
        data: {
          scope: 'active_account',
          organization_id: orgId,
          ...report,
        },
      });
    }
    return reply.send({
      success: true,
      data: {
        scope: 'active_account',
        organization_id: orgId,
        ...report,
      },
    });
  });

  app.put('/integrations/runtime/:integrationType/config', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { integrationType } = request.params as { integrationType: string };
    const type = normalizeIntegrationType(integrationType);
    const body = (request.body || {}) as {
      config?: Record<string, unknown>;
      secret_refs?: Record<string, string>;
    };
    if (!type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'integrationType is required' } });
    }
    if (!rejectUnsupportedIntegrationType(type, reply)) return;
    if (!requireGlobalAdmin(request, reply)) return;

    const config = body.config && typeof body.config === 'object' ? body.config : {};
    const actorUserId = String((request as any).userId || '') || null;
    const secretRefs = body.secret_refs && typeof body.secret_refs === 'object' ? body.secret_refs : {};
    const entries = Object.entries(secretRefs)
      .map(([k, v]) => ({ key: String(k).trim(), ref: String(v || '').trim() }))
      .filter((row) => row.key && row.ref);
    const invalidSecretRef = entries.find((row) => !isValidSecretRef(row.ref));
    if (invalidSecretRef) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: `secret_refs.${invalidSecretRef.key} must use env://, vault://, or sops:// scheme with safe path characters`,
        },
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO integration_runtime_configs (organization_id, integration_type, config, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, NOW(), $4)
         ON CONFLICT (organization_id, integration_type) DO UPDATE
         SET config = $3::jsonb, updated_at = NOW(), updated_by = $4`,
        [orgId, type, JSON.stringify(config), actorUserId],
      );

      await client.query(
        `DELETE FROM integration_runtime_secret_refs
         WHERE organization_id = $1 AND integration_type = $2`,
        [orgId, type],
      );
      for (const row of entries) {
        await client.query(
          `INSERT INTO integration_runtime_secret_refs
             (organization_id, integration_type, secret_key, secret_ref, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [orgId, type, row.key, row.ref, actorUserId],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return reply.send({
      success: true,
      data: { integration_type: type, updated: true, secret_ref_count: entries.length },
    });
  });

  app.post('/integrations/runtime/:integrationType/deploy', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { integrationType } = request.params as { integrationType: string };
    const type = normalizeIntegrationType(integrationType);
    const body = (request.body || {}) as {
      runtime_mode?: 'container' | 'local_worker';
      image_ref?: string;
      deployment_spec?: Record<string, unknown>;
    };
    if (!type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'integrationType is required' } });
    }
    if (!rejectUnsupportedIntegrationType(type, reply)) return;
    if (!requireGlobalAdmin(request, reply)) return;

    const runtimeMode = body.runtime_mode === 'local_worker' ? 'local_worker' : 'container';
    const imageRef = String(body.image_ref || '').trim() || null;
    if (!isSafeImageRef(imageRef || '')) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'image_ref contains unsupported characters' },
      });
    }
    const deploymentSpec = body.deployment_spec && typeof body.deployment_spec === 'object' ? body.deployment_spec : {};
    const storagePath = deriveStoragePath(orgId, type);
    const networkScope = deriveNetworkScope(orgId);

    await pool.query(
      `INSERT INTO integration_runtime_instances
         (organization_id, integration_type, runtime_mode, status, image_ref, storage_path, network_scope,
          deployment_spec, last_error, last_deployed_at, updated_at)
       VALUES
         ($1, $2, $3, 'deploying', $4, $5, $6, $7::jsonb, NULL, NOW(), NOW())
       ON CONFLICT (organization_id, integration_type) DO UPDATE
       SET runtime_mode = $3,
           status = 'deploying',
           image_ref = $4,
           storage_path = $5,
           network_scope = $6,
           deployment_spec = $7::jsonb,
           last_error = NULL,
           last_deployed_at = NOW(),
           updated_at = NOW()`,
      [orgId, type, runtimeMode, imageRef, storagePath, networkScope, JSON.stringify(deploymentSpec)],
    );

    const orchestration = await orchestrator.execute({
      action: 'deploy',
      integrationType: type,
      organizationId: orgId,
      runtimeMode,
      imageRef,
      storagePath,
      networkScope,
    });

    if (!orchestration.ok) {
      const safeError = tenantSafeRuntimeError(orchestration.error, 'Runtime deploy failed');
      app.log.warn(
        {
          org_id: orgId,
          integration_type: type,
          runtime_mode: runtimeMode,
          command_executed: orchestration.executed,
          runtime_error: String(orchestration.error || ''),
        },
        'Integration runtime deploy failed',
      );
      await pool.query(
        `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
         WHERE organization_id = $1
           AND integration_type = $2`,
        [orgId, type, safeError],
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: 'RUNTIME_DEPLOY_FAILED',
          message: safeError,
        },
        data: {
          integration_type: type,
          runtime_mode: runtimeMode,
          command_executed: orchestration.executed,
        },
      });
    }

    const nextStatus = orchestration.executed ? 'running' : 'stopped';
    await pool.query(
      `UPDATE integration_runtime_instances
       SET status = $3,
           last_error = NULL,
           updated_at = NOW()
       WHERE organization_id = $1
         AND integration_type = $2`,
      [orgId, type, nextStatus],
    );

    return reply.send({
      success: true,
      data: {
        integration_type: type,
        runtime_mode: runtimeMode,
        status: nextStatus,
        storage_path: storagePath,
        network_scope: networkScope,
        command_executed: orchestration.executed,
        runtime_hooks: orchestrator.getHookReadiness(type),
      },
    });
  });

  app.post('/integrations/runtime/:integrationType/stop', async (request, reply) => {
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    }
    const { integrationType } = request.params as { integrationType: string };
    const type = normalizeIntegrationType(integrationType);
    if (!type) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'integrationType is required' } });
    }
    if (!rejectUnsupportedIntegrationType(type, reply)) return;
    if (!requireGlobalAdmin(request, reply)) return;

    const existing = await pool.query(
      `SELECT integration_type, runtime_mode, image_ref, storage_path, network_scope
       FROM integration_runtime_instances
       WHERE organization_id = $1 AND integration_type = $2
       LIMIT 1`,
      [orgId, type],
    );
    if (existing.rows.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Integration runtime not found' } });
    }

    await pool.query(
      `UPDATE integration_runtime_instances
       SET status = 'deploying', updated_at = NOW()
       WHERE organization_id = $1 AND integration_type = $2`,
      [orgId, type],
    );

    const row = existing.rows[0];
    const runtimeMode = String(row.runtime_mode || 'container') === 'local_worker' ? 'local_worker' : 'container';
    const orchestration = await orchestrator.execute({
      action: 'stop',
      integrationType: type,
      organizationId: orgId,
      runtimeMode,
      imageRef: row.image_ref ? String(row.image_ref) : null,
      storagePath: row.storage_path ? String(row.storage_path) : null,
      networkScope: row.network_scope ? String(row.network_scope) : null,
    });

    if (!orchestration.ok) {
      const safeError = tenantSafeRuntimeError(orchestration.error, 'Runtime stop failed');
      app.log.warn(
        {
          org_id: orgId,
          integration_type: type,
          runtime_mode: runtimeMode,
          command_executed: orchestration.executed,
          runtime_error: String(orchestration.error || ''),
        },
        'Integration runtime stop failed',
      );
      await pool.query(
        `UPDATE integration_runtime_instances
         SET status = 'error',
             last_error = $3,
             updated_at = NOW()
         WHERE organization_id = $1
           AND integration_type = $2`,
        [orgId, type, safeError],
      );
      return reply.status(500).send({
        success: false,
        error: {
          code: 'RUNTIME_STOP_FAILED',
          message: safeError,
        },
        data: {
          integration_type: type,
          command_executed: orchestration.executed,
        },
      });
    }

    const updated = await pool.query(
      `UPDATE integration_runtime_instances
       SET status = 'stopped',
           last_error = NULL,
           updated_at = NOW()
       WHERE organization_id = $1 AND integration_type = $2
       RETURNING integration_type, status, updated_at`,
      [orgId, type],
    );
    return reply.send({
      success: true,
      data: {
        ...updated.rows[0],
        command_executed: orchestration.executed,
        runtime_hooks: orchestrator.getHookReadiness(type),
      },
    });
  });
}

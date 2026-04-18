// ---------------------------------------------------------------------------
// Agent Business Spaces — admin CRUD for *.from.sven.systems subdomains.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('business-spaces');

// ---- reserved subdomains (never claimable by agents) ----------------------
const RESERVED_SUBDOMAINS = new Set([
  'admin', 'api', 'app', 'auth', 'blog', 'cdn', 'dev', 'docs', 'eidolon',
  'ftp', 'git', 'grafana', 'help', 'internal', 'mail', 'market', 'metrics',
  'misiuni', 'monitor', 'nats', 'ns1', 'ns2', 'portal', 'proxy', 'staging',
  'status', 'support', 'test', 'vpn', 'wiki', 'www',
]);

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;
const VALID_LANDING_TYPES = ['storefront', 'portfolio', 'api_explorer', 'service_page'] as const;
const VALID_STATUSES = ['inactive', 'pending', 'active', 'suspended'] as const;

type LandingType = (typeof VALID_LANDING_TYPES)[number];
type BusinessStatus = (typeof VALID_STATUSES)[number];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

function validateSubdomain(subdomain: string): string | null {
  if (!subdomain) return 'subdomain is required';
  if (!SUBDOMAIN_REGEX.test(subdomain)) return 'subdomain must be 3-40 chars, lowercase alphanumeric + hyphens, cannot start/end with hyphen';
  if (RESERVED_SUBDOMAINS.has(subdomain)) return `subdomain "${subdomain}" is reserved`;
  return null;
}

export function registerBusinessSpaceRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // GET /business-spaces — list all spaces
  app.get('/business-spaces', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const q = req.query as { status?: string; archetype?: string; limit?: string; offset?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = 'ap.org_id = $1 AND ap.business_subdomain IS NOT NULL';
    const params: unknown[] = [orgId];
    let idx = 2;

    if (q.status && VALID_STATUSES.includes(q.status as BusinessStatus)) {
      where += ` AND ap.business_status = $${idx++}`;
      params.push(q.status);
    }
    if (q.archetype) {
      where += ` AND ap.archetype = $${idx++}`;
      params.push(q.archetype);
    }

    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT ap.agent_id, ap.display_name, ap.archetype, ap.business_subdomain,
              ap.business_url, ap.business_status, ap.business_landing_type,
              ap.business_tagline, ap.business_activated_at,
              be.status AS endpoint_status, be.uptime_pct, be.total_requests,
              be.last_health_at
       FROM agent_profiles ap
       LEFT JOIN agent_business_endpoints be ON be.agent_id = ap.agent_id
       WHERE ${where}
       ORDER BY ap.business_activated_at DESC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM agent_profiles ap WHERE ${where}`,
      params.slice(0, params.length - 2),
    );

    return reply.send({
      success: true,
      data: rows.map(toBusinessSpace),
      pagination: { total: countRes.rows[0]?.total ?? 0, limit, offset },
    });
  });

  // GET /business-spaces/reserved — list reserved subdomains
  app.get('/business-spaces/reserved', async (_req, reply) => {
    return reply.send({ success: true, data: [...RESERVED_SUBDOMAINS].sort() });
  });

  // GET /business-spaces/:agentId — single agent's business space
  app.get<{ Params: { agentId: string } }>('/business-spaces/:agentId', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const { rows } = await pool.query(
      `SELECT ap.agent_id, ap.display_name, ap.archetype, ap.business_subdomain,
              ap.business_url, ap.business_status, ap.business_landing_type,
              ap.business_tagline, ap.business_activated_at,
              be.status AS endpoint_status, be.uptime_pct, be.total_requests,
              be.last_health_at, be.internal_url, be.health_check_path
       FROM agent_profiles ap
       LEFT JOIN agent_business_endpoints be ON be.agent_id = ap.agent_id
       WHERE ap.org_id = $1 AND ap.agent_id = $2`,
      [orgId, req.params.agentId],
    );
    if (!rows.length) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
    }
    return reply.send({ success: true, data: toBusinessSpace(rows[0]) });
  });

  // POST /business-spaces — register a new business space
  app.post('/business-spaces', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as {
      agentId?: string;
      subdomain?: string;
      tagline?: string;
      landingType?: LandingType;
      internalUrl?: string;
    };

    if (!body.agentId?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_AGENT', message: 'agentId required' } });
    }
    if (!body.subdomain?.trim()) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_SUBDOMAIN', message: 'subdomain required' } });
    }

    const subdomain = body.subdomain.trim().toLowerCase();
    const valErr = validateSubdomain(subdomain);
    if (valErr) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_SUBDOMAIN', message: valErr } });
    }

    const landingType = body.landingType && VALID_LANDING_TYPES.includes(body.landingType)
      ? body.landingType : 'storefront';
    const businessUrl = `https://${subdomain}.from.sven.systems`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify agent exists and belongs to org
      const agentRes = await client.query(
        'SELECT agent_id, business_subdomain FROM agent_profiles WHERE org_id = $1 AND agent_id = $2',
        [orgId, body.agentId],
      );
      if (!agentRes.rows.length) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ success: false, error: { code: 'AGENT_NOT_FOUND', message: 'Agent not found in this org' } });
      }
      if (agentRes.rows[0].business_subdomain) {
        await client.query('ROLLBACK');
        return reply.status(409).send({ success: false, error: { code: 'ALREADY_HAS_SPACE', message: 'Agent already has a business space' } });
      }

      // Set business fields on profile
      await client.query(
        `UPDATE agent_profiles
         SET business_subdomain = $1, business_url = $2, business_status = 'pending',
             business_landing_type = $3, business_tagline = $4, updated_at = NOW()
         WHERE agent_id = $5`,
        [subdomain, businessUrl, landingType, body.tagline ?? null, body.agentId],
      );

      // Create endpoint record
      const endpointId = newId('bep');
      await client.query(
        `INSERT INTO agent_business_endpoints
           (id, agent_id, business_subdomain, internal_url, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [endpointId, body.agentId, subdomain, body.internalUrl ?? null],
      );

      await client.query('COMMIT');

      logger.info('Business space created', { agentId: body.agentId, subdomain });

      publishNats(natsConn, 'sven.agent.business_created', {
        agentId: body.agentId, subdomain, businessUrl, landingType,
      });

      return reply.status(201).send({
        success: true,
        data: {
          agentId: body.agentId,
          subdomain,
          businessUrl,
          businessStatus: 'pending',
          landingType,
          tagline: body.tagline ?? null,
          endpointId,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Business space creation failed', { err: msg });
      if (msg.includes('23505') || msg.includes('unique')) {
        return reply.status(409).send({ success: false, error: { code: 'SUBDOMAIN_TAKEN', message: 'Subdomain already claimed' } });
      }
      return reply.status(500).send({ success: false, error: { code: 'CREATE_FAILED', message: msg } });
    } finally {
      client.release();
    }
  });

  // PATCH /business-spaces/:agentId — update space config
  app.patch<{ Params: { agentId: string } }>('/business-spaces/:agentId', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as {
      tagline?: string;
      landingType?: LandingType;
      internalUrl?: string;
      healthCheckPath?: string;
      activate?: boolean;
      deactivate?: boolean;
    };

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (body.tagline !== undefined) {
      sets.push(`business_tagline = $${idx++}`);
      params.push(body.tagline);
    }
    if (body.landingType && VALID_LANDING_TYPES.includes(body.landingType)) {
      sets.push(`business_landing_type = $${idx++}`);
      params.push(body.landingType);
    }
    if (body.activate) {
      sets.push(`business_status = 'active'`);
      sets.push(`business_activated_at = NOW()`);
    } else if (body.deactivate) {
      sets.push(`business_status = 'suspended'`);
    }

    params.push(orgId, req.params.agentId);

    const { rowCount } = await pool.query(
      `UPDATE agent_profiles SET ${sets.join(', ')}
       WHERE org_id = $${idx++} AND agent_id = $${idx}
         AND business_subdomain IS NOT NULL`,
      params,
    );

    if (!rowCount) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Business space not found' } });
    }

    // Update endpoint if needed
    if (body.internalUrl !== undefined || body.healthCheckPath !== undefined) {
      const epSets: string[] = ['updated_at = NOW()'];
      const epParams: unknown[] = [];
      let epIdx = 1;
      if (body.internalUrl !== undefined) {
        epSets.push(`internal_url = $${epIdx++}`);
        epParams.push(body.internalUrl);
      }
      if (body.healthCheckPath !== undefined) {
        epSets.push(`health_check_path = $${epIdx++}`);
        epParams.push(body.healthCheckPath);
      }
      epParams.push(req.params.agentId);
      await pool.query(
        `UPDATE agent_business_endpoints SET ${epSets.join(', ')} WHERE agent_id = $${epIdx}`,
        epParams,
      );
    }

    if (body.activate) {
      publishNats(natsConn, 'sven.agent.business_activated', { agentId: req.params.agentId });
    } else if (body.deactivate) {
      publishNats(natsConn, 'sven.agent.business_deactivated', { agentId: req.params.agentId });
    }

    return reply.send({ success: true, data: { agentId: req.params.agentId, updated: true } });
  });

  // DELETE /business-spaces/:agentId — soft deactivate
  app.delete<{ Params: { agentId: string } }>('/business-spaces/:agentId', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const { rowCount } = await pool.query(
      `UPDATE agent_profiles
       SET business_status = 'inactive', updated_at = NOW()
       WHERE org_id = $1 AND agent_id = $2 AND business_subdomain IS NOT NULL`,
      [orgId, req.params.agentId],
    );
    if (!rowCount) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Business space not found' } });
    }

    publishNats(natsConn, 'sven.agent.business_deactivated', { agentId: req.params.agentId });
    return reply.send({ success: true, data: { agentId: req.params.agentId, deactivated: true } });
  });
}

// ---- helpers ----------------------------------------------------------------

function toBusinessSpace(row: Record<string, unknown>) {
  return {
    agentId: row.agent_id,
    displayName: row.display_name,
    archetype: row.archetype,
    subdomain: row.business_subdomain,
    businessUrl: row.business_url,
    businessStatus: row.business_status,
    landingType: row.business_landing_type,
    tagline: row.business_tagline,
    activatedAt: row.business_activated_at ?? null,
    endpoint: row.endpoint_status != null ? {
      status: row.endpoint_status,
      uptimePct: Number(row.uptime_pct) || 0,
      totalRequests: Number(row.total_requests) || 0,
      lastHealthAt: row.last_health_at ?? null,
      internalUrl: row.internal_url ?? null,
      healthCheckPath: row.health_check_path ?? null,
    } : null,
  };
}

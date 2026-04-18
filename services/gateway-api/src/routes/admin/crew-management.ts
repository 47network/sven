// ---------------------------------------------------------------------------
// Agent Crew Management — admin CRUD for crews + membership.
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { NatsConnection } from 'nats';
import { createLogger } from '@sven/shared';

const logger = createLogger('crew-management');

const VALID_CREW_TYPES = ['publishing', 'research', 'operations', 'marketing', 'legal_compliance', 'custom'] as const;
const VALID_CREW_STATUSES = ['active', 'suspended', 'disbanded'] as const;
const VALID_MEMBER_ROLES = ['lead', 'member', 'specialist', 'observer'] as const;

const CREW_MAX_MEMBERS: Record<string, number> = {
  publishing: 10, research: 8, operations: 8, marketing: 8,
  legal_compliance: 6, custom: 15,
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishNats(nc: NatsConnection | null, subject: string, payload: Record<string, unknown>): void {
  if (!nc) return;
  try { nc.publish(subject, Buffer.from(JSON.stringify(payload))); }
  catch (err) { logger.warn('NATS publish failed', { subject, err: (err as Error).message }); }
}

export function registerCrewManagementRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc?: NatsConnection | null,
) {
  const natsConn = nc ?? null;

  // GET /crews/templates — list crew templates with suggested archetypes
  app.get('/crews/templates', async (_req, reply) => {
    // Import dynamically to avoid bundling issues — types are also available
    const templates = VALID_CREW_TYPES.map((t) => ({
      type: t,
      maxMembers: CREW_MAX_MEMBERS[t] ?? 15,
    }));
    return reply.send({ success: true, templates });
  });

  // GET /crews — list all crews
  app.get('/crews', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const q = req.query as { crew_type?: string; status?: string; limit?: string; offset?: string };
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const offset = Math.max(0, Number(q.offset) || 0);

    let where = 'c.org_id = $1';
    const params: unknown[] = [orgId];
    let idx = 2;

    if (q.crew_type && VALID_CREW_TYPES.includes(q.crew_type as any)) {
      where += ` AND c.crew_type = $${idx++}`;
      params.push(q.crew_type);
    }
    if (q.status && VALID_CREW_STATUSES.includes(q.status as any)) {
      where += ` AND c.status = $${idx++}`;
      params.push(q.status);
    }

    const res = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*)::int FROM agent_crew_members m WHERE m.crew_id = c.id) AS member_count
         FROM agent_crews c
        WHERE ${where}
        ORDER BY c.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    return reply.send({ success: true, crews: res.rows, pagination: { limit, offset, returned: res.rows.length } });
  });

  // GET /crews/:crewId — single crew + members
  app.get('/crews/:crewId', async (req, reply) => {
    const { crewId } = req.params as { crewId: string };
    const orgId = (req as any).orgId ?? 'default';

    const crewRes = await pool.query('SELECT * FROM agent_crews WHERE id = $1 AND org_id = $2', [crewId, orgId]);
    if (crewRes.rows.length === 0) return reply.status(404).send({ success: false, error: 'Crew not found' });

    const membersRes = await pool.query(
      `SELECT m.*, ap.display_name, ap.archetype, ap.status AS agent_status
         FROM agent_crew_members m
         LEFT JOIN agent_profiles ap ON ap.agent_id = m.agent_id
        WHERE m.crew_id = $1
        ORDER BY m.role_in_crew, m.joined_at`,
      [crewId],
    );

    return reply.send({ success: true, crew: crewRes.rows[0], members: membersRes.rows });
  });

  // POST /crews — create a crew
  app.post('/crews', async (req, reply) => {
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as {
      name?: string;
      crew_type?: string;
      description?: string;
      lead_agent_id?: string;
    };

    if (!body.name?.trim()) return reply.status(400).send({ success: false, error: 'name is required' });
    if (!body.crew_type || !VALID_CREW_TYPES.includes(body.crew_type as any)) {
      return reply.status(400).send({ success: false, error: `crew_type must be one of: ${VALID_CREW_TYPES.join(', ')}` });
    }

    const id = newId('crew');
    const crewRes = await pool.query(
      `INSERT INTO agent_crews (id, org_id, name, crew_type, description, lead_agent_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [id, orgId, body.name.trim(), body.crew_type, body.description ?? null, body.lead_agent_id ?? null],
    );

    // If lead_agent_id provided, add them as lead member
    if (body.lead_agent_id) {
      await pool.query(
        `INSERT INTO agent_crew_members (crew_id, agent_id, role_in_crew) VALUES ($1, $2, 'lead')
         ON CONFLICT DO NOTHING`,
        [id, body.lead_agent_id],
      );
    }

    logger.info('Crew created', { id, name: body.name, type: body.crew_type });
    publishNats(natsConn, 'sven.crew.created', {
      crewId: id, name: body.name, crewType: body.crew_type, leadAgentId: body.lead_agent_id,
    });

    return reply.status(201).send({ success: true, crew: crewRes.rows[0] });
  });

  // PATCH /crews/:crewId — update crew
  app.patch('/crews/:crewId', async (req, reply) => {
    const { crewId } = req.params as { crewId: string };
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as { name?: string; description?: string; status?: string; lead_agent_id?: string };

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (body.name) { sets.push(`name = $${idx++}`); params.push(body.name.trim()); }
    if (body.description !== undefined) { sets.push(`description = $${idx++}`); params.push(body.description); }
    if (body.status && VALID_CREW_STATUSES.includes(body.status as any)) {
      sets.push(`status = $${idx++}`); params.push(body.status);
    }
    if (body.lead_agent_id !== undefined) {
      sets.push(`lead_agent_id = $${idx++}`); params.push(body.lead_agent_id || null);
    }

    params.push(crewId, orgId);
    const res = await pool.query(
      `UPDATE agent_crews SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx++} RETURNING *`,
      params,
    );
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Crew not found' });
    return reply.send({ success: true, crew: res.rows[0] });
  });

  // POST /crews/:crewId/members — add member
  app.post('/crews/:crewId/members', async (req, reply) => {
    const { crewId } = req.params as { crewId: string };
    const orgId = (req as any).orgId ?? 'default';
    const body = req.body as { agent_id?: string; role_in_crew?: string };

    if (!body.agent_id) return reply.status(400).send({ success: false, error: 'agent_id is required' });

    const role = body.role_in_crew && VALID_MEMBER_ROLES.includes(body.role_in_crew as any)
      ? body.role_in_crew : 'member';

    // Verify crew exists and belongs to org
    const crewRes = await pool.query('SELECT * FROM agent_crews WHERE id = $1 AND org_id = $2', [crewId, orgId]);
    if (crewRes.rows.length === 0) return reply.status(404).send({ success: false, error: 'Crew not found' });

    const crew = crewRes.rows[0];
    const maxMembers = CREW_MAX_MEMBERS[crew.crew_type] ?? 15;

    // Check member count
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM agent_crew_members WHERE crew_id = $1',
      [crewId],
    );
    if ((countRes.rows[0]?.cnt ?? 0) >= maxMembers) {
      return reply.status(400).send({ success: false, error: `Crew has reached max members (${maxMembers})` });
    }

    await pool.query(
      `INSERT INTO agent_crew_members (crew_id, agent_id, role_in_crew) VALUES ($1, $2, $3)
       ON CONFLICT (crew_id, agent_id) DO UPDATE SET role_in_crew = EXCLUDED.role_in_crew`,
      [crewId, body.agent_id, role],
    );

    logger.info('Crew member added', { crewId, agentId: body.agent_id, role });
    publishNats(natsConn, 'sven.crew.member_added', {
      crewId, agentId: body.agent_id, role, crewName: crew.name,
    });

    return reply.status(201).send({ success: true, crewId, agentId: body.agent_id, role });
  });

  // DELETE /crews/:crewId/members/:agentId — remove member
  app.delete('/crews/:crewId/members/:agentId', async (req, reply) => {
    const { crewId, agentId } = req.params as { crewId: string; agentId: string };
    const res = await pool.query(
      'DELETE FROM agent_crew_members WHERE crew_id = $1 AND agent_id = $2',
      [crewId, agentId],
    );
    if (res.rowCount === 0) return reply.status(404).send({ success: false, error: 'Member not found' });
    return reply.send({ success: true, message: 'Member removed' });
  });

  // POST /crews/:crewId/disband — disband crew
  app.post('/crews/:crewId/disband', async (req, reply) => {
    const { crewId } = req.params as { crewId: string };
    const orgId = (req as any).orgId ?? 'default';
    const res = await pool.query(
      `UPDATE agent_crews SET status = 'disbanded', updated_at = NOW()
        WHERE id = $1 AND org_id = $2 RETURNING *`,
      [crewId, orgId],
    );
    if (res.rows.length === 0) return reply.status(404).send({ success: false, error: 'Crew not found' });
    logger.info('Crew disbanded', { crewId });
    return reply.send({ success: true, crew: res.rows[0] });
  });
}

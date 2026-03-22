import { FastifyInstance } from 'fastify';
import pg from 'pg';

function isSchemaCompatError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code || '');
  return code === '42P01' || code === '42703';
}

function sendImprovementsSchemaUnavailable(reply: any): void {
  reply.status(503).send({
    success: false,
    error: {
      code: 'FEATURE_UNAVAILABLE',
      message: 'Improvements schema not available in this environment',
    },
  });
}

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '').trim() === 'platform_admin') return true;
  reply.status(403).send({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
  });
  return false;
}

function requireActiveOrg(request: any, reply: any): boolean {
  if (String(request.orgId || '').trim()) return true;
  reply.status(403).send({
    success: false,
    error: { code: 'ORG_REQUIRED', message: 'Active account required' },
  });
  return false;
}

function mapRow(row: Record<string, unknown>) {
  const rawStatus = String(row.status || '');
  const status =
    rawStatus === 'proposed'
      ? 'pending'
      : rawStatus === 'accepted' || rawStatus === 'in_progress' || rawStatus === 'completed'
        ? 'approved'
        : rawStatus === 'rejected'
          ? 'dismissed'
          : rawStatus || 'pending';

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.source,
    confidence: row.priority,
    status,
    raw_status: rawStatus,
    created_at: row.created_at,
    decided_at: rawStatus === 'proposed' ? null : row.updated_at,
    updated_at: row.updated_at,
  };
}

export async function registerImprovementsRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/improvements', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    try {
      const res = await pool.query(
        `SELECT id, title, description, source, NULL::int AS priority, status, created_at, updated_at
         FROM improvement_items
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [String((request as any).orgId || '').trim()],
      );
      reply.send({ success: true, data: res.rows.map((row) => mapRow(row)) });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendImprovementsSchemaUnavailable(reply);
        return;
      }
      throw err;
    }
  });

  app.post('/improvements/:id/approve', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const res = await pool.query(
        `UPDATE improvement_items
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1
           AND organization_id = $2
         RETURNING id, title, description, source, NULL::int AS priority, status, created_at, updated_at`,
        [id, String((request as any).orgId || '').trim()],
      );
      if (res.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Improvement not found' } });
        return;
      }
      reply.send({ success: true, data: mapRow(res.rows[0]) });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendImprovementsSchemaUnavailable(reply);
        return;
      }
      throw err;
    }
  });

  app.post('/improvements/:id/dismiss', async (request, reply) => {
    if (!requireGlobalAdmin(request, reply)) return;
    if (!requireActiveOrg(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const res = await pool.query(
        `UPDATE improvement_items
         SET status = 'rejected', updated_at = NOW()
         WHERE id = $1
           AND organization_id = $2
         RETURNING id, title, description, source, NULL::int AS priority, status, created_at, updated_at`,
        [id, String((request as any).orgId || '').trim()],
      );
      if (res.rows.length === 0) {
        reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Improvement not found' } });
        return;
      }
      reply.send({ success: true, data: mapRow(res.rows[0]) });
    } catch (err) {
      if (isSchemaCompatError(err)) {
        sendImprovementsSchemaUnavailable(reply);
        return;
      }
      throw err;
    }
  });
}

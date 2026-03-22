import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { isUuid } from '../../lib/input-validation.js';

function parseLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

export async function registerLlmAuditRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/llm/audit', async (request, reply) => {
    const isPlatformAdmin = String((request as any).userRole || '').trim() === 'platform_admin';
    const orgId = String((request as any).orgId || '').trim();
    if (!isPlatformAdmin && !orgId) {
      reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
      return;
    }
    const query = request.query as { chat_id?: string; user_id?: string; limit?: string };
    if (query.chat_id && !isUuid(String(query.chat_id))) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'chat_id must be a UUID' },
      });
      return;
    }
    if (query.user_id && !isUuid(String(query.user_id))) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'user_id must be a UUID' },
      });
      return;
    }
    const limit = parseLimit(query.limit, 200, 1, 500);
    if (limit === null) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 500' },
      });
      return;
    }
    const params: unknown[] = [];
    let sql = '';
    if (isPlatformAdmin) {
      sql = `SELECT l.* FROM llm_audit_log l WHERE 1=1`;
    } else {
      params.push(orgId);
      sql = `SELECT l.*
             FROM llm_audit_log l
             JOIN chats c
               ON c.id = l.chat_id
             WHERE c.organization_id = $1`;
    }

    if (query.chat_id) {
      params.push(query.chat_id);
      sql += ` AND l.chat_id = $${params.length}`;
    }
    if (query.user_id) {
      params.push(query.user_id);
      sql += ` AND l.user_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(sql, params);
    reply.send({ success: true, data: { rows: result.rows } });
  });
}

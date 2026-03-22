import { FastifyInstance } from 'fastify';
import pg from 'pg';

type GlobalSearchResult = {
  type: 'approval' | 'run' | 'user' | 'chat';
  title: string;
  description: string;
  href: string;
};

export async function registerGlobalSearchRoutes(app: FastifyInstance, pool: pg.Pool) {
  function currentOrgId(request: any): string | null {
    const orgId = String(request.orgId || '').trim();
    return orgId || null;
  }

  app.get('/global-search', async (request, reply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }

    const query = request.query as { q?: string; limit?: string };
    const term = String(query.q || '').trim();
    if (term.length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'q must be at least 2 characters' },
      });
    }

    const limitRaw = Number.parseInt(String(query.limit || '20'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
    const perTypeLimit = Math.max(3, Math.ceil(limit / 4));
    const like = `%${term}%`;

    const [approvalsRes, runsRes, usersRes, chatsRes] = await Promise.all([
      pool.query(
        `SELECT a.id, a.tool_name, a.status, a.created_at
         FROM approvals a
         JOIN chats c ON c.id = a.chat_id
         WHERE c.organization_id = $1
           AND (
             a.id::text ILIKE $2
             OR a.tool_name ILIKE $2
             OR a.status ILIKE $2
           )
         ORDER BY a.created_at DESC
         LIMIT $3`,
        [orgId, like, perTypeLimit],
      ),
      pool.query(
        `SELECT tr.id, tr.tool_name, tr.status, tr.created_at
         FROM tool_runs tr
         JOIN chats c ON c.id = tr.chat_id
         WHERE c.organization_id = $1
           AND (
             tr.id::text ILIKE $2
             OR tr.tool_name ILIKE $2
             OR tr.status ILIKE $2
           )
         ORDER BY tr.created_at DESC
         LIMIT $3`,
        [orgId, like, perTypeLimit],
      ),
      pool.query(
        `SELECT u.id, u.username, u.display_name, u.role
         FROM users u
         JOIN organization_memberships m ON m.user_id = u.id
         WHERE m.organization_id = $1
           AND m.status = 'active'
           AND (
             u.id::text ILIKE $2
             OR u.username ILIKE $2
             OR COALESCE(u.display_name, '') ILIKE $2
           )
         ORDER BY u.updated_at DESC NULLS LAST, u.created_at DESC
         LIMIT $3`,
        [orgId, like, perTypeLimit],
      ),
      pool.query(
        `SELECT c.id, c.name, c.channel_type, c.created_at
         FROM chats c
         WHERE c.organization_id = $1
           AND (
             c.id::text ILIKE $2
             OR c.name ILIKE $2
             OR c.channel_type ILIKE $2
           )
         ORDER BY c.created_at DESC
         LIMIT $3`,
        [orgId, like, perTypeLimit],
      ),
    ]);

    const results: GlobalSearchResult[] = [
      ...approvalsRes.rows.map((row) => ({
        type: 'approval' as const,
        title: `Approval ${String(row.id || '').slice(0, 8)}`,
        description: `${String(row.tool_name || 'unknown tool')} · ${String(row.status || 'unknown')}`,
        href: '/approvals',
      })),
      ...runsRes.rows.map((row) => ({
        type: 'run' as const,
        title: `Run ${String(row.id || '').slice(0, 8)}`,
        description: `${String(row.tool_name || 'unknown tool')} · ${String(row.status || 'unknown')}`,
        href: '/runs',
      })),
      ...usersRes.rows.map((row) => ({
        type: 'user' as const,
        title: String(row.display_name || row.username || 'user'),
        description: `${String(row.username || '')} · ${String(row.role || 'member')}`,
        href: '/users',
      })),
      ...chatsRes.rows.map((row) => ({
        type: 'chat' as const,
        title: String(row.name || `Chat ${String(row.id || '').slice(0, 8)}`),
        description: String(row.channel_type || 'channel'),
        href: '/chats',
      })),
    ].slice(0, limit);

    return reply.send({ success: true, data: results, meta: { q: term, limit } });
  });
}

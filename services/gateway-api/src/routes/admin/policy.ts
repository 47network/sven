import { FastifyInstance } from 'fastify';
import pg from 'pg';

type PolicySimBody = {
  user_id?: string;
  tool_name?: string;
  action?: string;
  context?: Record<string, unknown>;
};

type PolicyRuleRow = {
  id: string;
  organization_id: string;
  scope: string;
  effect: string;
  target_type: string;
  target_id: string | null;
  conditions: unknown;
  created_at: string;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.trim().length > 0)));
}

function readChatId(context: Record<string, unknown>): string | null {
  const direct = context.chat_id;
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const camel = context.chatId;
  if (typeof camel === 'string' && camel.trim().length > 0) return camel.trim();
  return null;
}

export async function registerPolicyRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.post('/policy/simulate', async (request, reply) => {
    const orgId = (request as any).orgId ? String((request as any).orgId) : null;
    const actorUserId = String((request as any).userId || '').trim();
    const isGlobalAdmin = String((request as any).userRole || '') === 'platform_admin';
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
      return;
    }
    if (!actorUserId) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
      return;
    }

    const body = (request.body || {}) as PolicySimBody;
    const tool = String(body.tool_name || '').trim();
    const action = String(body.action || '').trim();
    const context = (body.context || {}) as Record<string, unknown>;
    const requestedUserId = typeof body.user_id === 'string' && body.user_id.trim().length > 0 ? body.user_id.trim() : null;
    const chatId = readChatId(context);
    const userId = requestedUserId || actorUserId;

    if (requestedUserId && requestedUserId !== actorUserId && !isGlobalAdmin) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot simulate policy context for another user' },
      });
      return;
    }

    if (!tool || !action) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'tool_name and action are required for policy simulation' },
        data: {
          input: { user_id: userId, tool_name: tool || null, action: action || null, context },
        },
      });
      return;
    }

    const userInOrg = await pool.query(
      `SELECT 1
       FROM organization_memberships
       WHERE organization_id = $1
         AND user_id = $2
         AND status = 'active'
       LIMIT 1`,
      [orgId, userId],
    );
    if (userInOrg.rows.length === 0) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Simulation context user is not active in organization' },
      });
      return;
    }

    if (chatId) {
      if (isGlobalAdmin) {
        const chatInOrg = await pool.query(
          `SELECT 1
           FROM chats
           WHERE id = $1
             AND organization_id = $2
           LIMIT 1`,
          [chatId, orgId],
        );
        if (chatInOrg.rows.length === 0) {
          reply.status(400).send({
            success: false,
            error: { code: 'VALIDATION', message: 'chat_id must belong to active organization' },
          });
          return;
        }
      } else {
        const callerHasChatAccess = await pool.query(
          `SELECT 1
           FROM chat_members cm
           JOIN chats c ON c.id = cm.chat_id
           WHERE cm.chat_id = $1
             AND cm.user_id = $2
             AND c.organization_id = $3
           LIMIT 1`,
          [chatId, userId, orgId],
        );
        if (callerHasChatAccess.rows.length === 0) {
          reply.status(403).send({
            success: false,
            error: { code: 'FORBIDDEN', message: 'chat_id is not accessible to simulation context user' },
          });
          return;
        }
      }
    }

    const scopeCandidates = unique([`${tool}.${action}`, `${tool}: ${action}`, `${tool}:*`, `${tool}.*`, tool, action, '*']);

    const rulesRes = await pool.query(
      `SELECT id, organization_id, scope, effect, target_type, target_id, conditions, created_at
       FROM permissions
       WHERE organization_id = $1
         AND scope = ANY($2::text[])
         AND (
           target_type = 'global'
           OR (target_type = 'user' AND target_id::text = COALESCE($3::text, ''))
           OR (target_type = 'chat' AND target_id::text = COALESCE($4::text, ''))
         )
       ORDER BY
         CASE target_type WHEN 'user' THEN 1 WHEN 'chat' THEN 2 ELSE 3 END,
         created_at DESC`,
      [orgId, scopeCandidates, userId, chatId],
    );

    const matchedRules = rulesRes.rows.map((row: PolicyRuleRow) => ({
      id: row.id,
      organization_id: row.organization_id,
      name: `${String(row.effect || '').toUpperCase()} ${String(row.scope || '')}`,
      description: `target=${String(row.target_type || 'global')}${isGlobalAdmin && row.target_id ? `:${String(row.target_id)}` : ''}`,
      effect: row.effect,
      scope: row.scope,
      target_type: row.target_type,
      ...(isGlobalAdmin ? { target_id: row.target_id, conditions: row.conditions } : {}),
    }));

    const hasDeny = matchedRules.some((rule) => String(rule.effect) === 'deny');
    const hasAllow = matchedRules.some((rule) => String(rule.effect) === 'allow');
    const allowed = hasDeny ? false : hasAllow;

    const explanation = hasDeny
      ? 'Denied by one or more matching policy rules'
      : hasAllow
        ? 'Allowed by matching policy rule(s)'
        : 'No matching policy rule found (default deny)';

    reply.send({
      success: true,
      data: {
        allowed,
        explanation,
        matched_rules: matchedRules,
        input: {
          user_id: userId,
          chat_id: chatId,
          tool_name: tool,
          action,
          scope_candidates: scopeCandidates,
          context,
        },
      },
    });
  });
}

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { requireRole } from './auth.js';
import { CompactionService } from '../services/CompactionService.js';

export async function registerSessionRoutes(app: FastifyInstance, pool: pg.Pool) {
  const authenticated = requireRole(pool, 'admin', 'user');
  const compaction = new CompactionService(pool);
  const requireSessionScope = (request: any): { userId: string; orgId: string } | null => {
    const userId = String(request.userId || '').trim();
    const orgId = String(request.orgId || '').trim();
    if (!userId || !orgId) return null;
    return { userId, orgId };
  };
  const mapSessionAccessError = (err: unknown, reply: any): boolean => {
    const statusCode = Number((err as any)?.statusCode || 0);
    const code = String((err as any)?.code || '');
    if (statusCode === 403 || code === 'FORBIDDEN') {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Session not found or access denied' },
      });
      return true;
    }
    return false;
  };

  app.post('/v1/sessions/:id/compact', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { keep_recent, force } = (request.body as { keep_recent?: number; force?: boolean }) || {};
    const scope = requireSessionScope(request);
    if (!scope) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    const keepRecent = Number.isFinite(keep_recent) ? Math.max(1, Number(keep_recent)) : 10;
    try {
      const data = await compaction.compactSession(id, scope, { keepRecent, force: Boolean(force) });
      reply.send({ success: true, data });
    } catch (err) {
      if (mapSessionAccessError(err, reply)) return;
      throw err;
    }
  });

  app.get('/v1/sessions/:id/token-usage', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scope = requireSessionScope(request);
    if (!scope) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    let usage;
    let decision;
    let estimatedCost;
    try {
      usage = await compaction.estimateTokenCount(id, scope);
      decision = await compaction.shouldCompact(id, scope);
      estimatedCost = await compaction.getSessionCostEstimateUsd(id, scope);
    } catch (err) {
      if (mapSessionAccessError(err, reply)) return;
      throw err;
    }

    reply.send({
      success: true,
      data: {
        message_count: usage.message_count,
        estimated_tokens: usage.estimated_tokens,
        model_context_window: usage.model_context_window,
        tracked_input_tokens: usage.tracked_input_tokens,
        tracked_output_tokens: usage.tracked_output_tokens,
        tracked_total_tokens: usage.tracked_total_tokens,
        threshold_pct: decision.threshold_pct,
        threshold_tokens: decision.threshold_tokens,
        warning_tokens: decision.warning_tokens,
        approaching_limit: decision.approaching_limit,
        auto_compact_enabled: decision.auto_compact_enabled,
        should_compact: decision.should_compact,
        estimated_cost_usd: estimatedCost,
      },
    });
  });

  app.get('/v1/sessions/:id/compaction-history', { preHandler: authenticated }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scope = requireSessionScope(request);
    if (!scope) {
      return reply.status(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
    try {
      const data = await compaction.getCompactionHistory(id, scope);
      reply.send({ success: true, data });
    } catch (err) {
      if (mapSessionAccessError(err, reply)) return;
      throw err;
    }
  });
}

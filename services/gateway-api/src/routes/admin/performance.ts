import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import * as PerformanceService from '../../services/PerformanceService.js';
import * as ToolCacheService from '../../services/ToolCacheService.js';
import * as RAGIncrementalService from '../../services/RAGIncrementalService.js';
import * as InferenceRoutingService from '../../services/InferenceRoutingService.js';
import { isSlug, isUuid } from '../../lib/input-validation.js';
import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'node:crypto';

function parseOptionalBoolean(raw: unknown): { valid: boolean; value: boolean | undefined } {
  if (raw === undefined) {
    return { valid: true, value: undefined };
  }
  if (typeof raw !== 'boolean') {
    return { valid: false, value: undefined };
  }
  return { valid: true, value: raw };
}

async function setActivePerformanceProfile(
  pool: Pool,
  profileName: string,
): Promise<{ found: boolean }> {
  await pool.query('BEGIN');
  try {
    const target = await pool.query(
      `SELECT id FROM performance_profiles WHERE profile_name = $1 LIMIT 1`,
      [profileName],
    );
    if (!target.rows.length) {
      await pool.query('ROLLBACK');
      return { found: false };
    }

    await pool.query(`UPDATE performance_profiles SET is_active = FALSE WHERE is_active = TRUE`);
    await pool.query(
      `UPDATE performance_profiles SET is_active = TRUE WHERE id = $1`,
      [target.rows[0].id],
    );
    await pool.query('COMMIT');
    return { found: true };
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

/**
 * Register performance & scaling routes
 */
export async function registerPerformanceRoutes(app: FastifyInstance, pool: Pool): Promise<void> {
  app.addHook('preHandler', async (request: any, reply: any) => {
    if (!request.orgId) {
      return reply.code(403).send({
        success: false,
        error: { code: 'ORG_REQUIRED', message: 'Active account required' },
      });
    }
  });

  /**
   * GET /performance/self-correction
   * Get self-correction retry metrics and distribution
   */
  app.get('/performance/self-correction', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const windowHoursRaw = Number(request.query?.window_hours || 168);
      const windowHours = Number.isFinite(windowHoursRaw)
        ? Math.min(Math.max(Math.trunc(windowHoursRaw), 1), 24 * 30)
        : 168;

      const totals = await pool.query(
        `SELECT
           COUNT(*)::int AS retries_total,
           COUNT(*) FILTER (WHERE tr.outcome = 'success')::int AS success_after_retry,
           COUNT(*) FILTER (WHERE tr.error_classification = 'transient')::int AS transient_count,
           COUNT(*) FILTER (WHERE tr.error_classification = 'strategy')::int AS strategy_count,
           COUNT(*) FILTER (WHERE tr.error_classification = 'fatal')::int AS fatal_count,
           COUNT(*) FILTER (WHERE tr.outcome = 'aborted')::int AS aborted_count
         FROM tool_retries tr
         JOIN tool_runs r ON r.id = tr.tool_call_id
         JOIN chats c ON c.id = r.chat_id
         WHERE c.organization_id = $1
           AND tr.created_at >= NOW() - ($2::int * INTERVAL '1 hour')`,
        [orgId, windowHours],
      );

      const row = totals.rows[0] || {};
      const retriesTotal = Number(row.retries_total || 0);
      const successAfterRetry = Number(row.success_after_retry || 0);
      const successRate = retriesTotal > 0
        ? Number(((successAfterRetry / retriesTotal) * 100).toFixed(2))
        : 0;

      reply.send({
        status: 'success',
        data: {
          window_hours: windowHours,
          retries_total: retriesTotal,
          success_after_retry: successAfterRetry,
          success_rate_pct: successRate,
          classification: {
            transient: Number(row.transient_count || 0),
            strategy: Number(row.strategy_count || 0),
            fatal: Number(row.fatal_count || 0),
          },
          outcomes: {
            aborted: Number(row.aborted_count || 0),
            success: successAfterRetry,
          },
        },
      });
    } catch (error) {
      console.error('Failed to get self-correction metrics:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get self-correction metrics' });
    }
  });

  /**
   * GET /performance/queue-status
   * Get current queue status with backpressure recommendations
   */
  app.get('/performance/queue-status', async (request: any, reply: any) => {
    try {
      const status = await PerformanceService.getQueueStatus();
      reply.send({
        status: 'success',
        data: status,
      });
    } catch (error) {
      console.error('Failed to get queue status:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get queue status' });
    }
  });

  /**
   * POST /performance/backpressure/activate
   * Manually activate backpressure
   */
  app.post('/performance/backpressure/activate', async (request: any, reply: any) => {
    try {
      const { reason = 'Manual activation' } = request.body || {};
      await PerformanceService.activateBackpressure(reason);
      reply.send({
        status: 'success',
        message: 'Backpressure activated',
      });
    } catch (error) {
      console.error('Failed to activate backpressure:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to activate backpressure' });
    }
  });

  /**
   * POST /performance/backpressure/deactivate
   * Manually deactivate backpressure
   */
  app.post('/performance/backpressure/deactivate', async (request: any, reply: any) => {
    try {
      await PerformanceService.deactivateBackpressure();
      reply.send({
        status: 'success',
        message: 'Backpressure deactivated',
      });
    } catch (error) {
      console.error('Failed to deactivate backpressure:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to deactivate backpressure' });
    }
  });

  /**
   * GET /performance/backpressure
   * Get current backpressure status
   */
  app.get('/performance/backpressure', async (request: any, reply: any) => {
    try {
      const status = await PerformanceService.getBackpressureStatus();
      reply.send({
        status: 'success',
        data: status,
      });
    } catch (error) {
      console.error('Failed to get backpressure status:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get backpressure status' });
    }
  });

  /**
   * GET /performance/cache/stats
   * Get cache statistics
   */
  app.get('/performance/cache/stats', async (request: any, reply: any) => {
    try {
      const stats = await ToolCacheService.getCacheStats();
      reply.send({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get cache stats' });
    }
  });

  /**
   * POST /performance/cache/clear/:toolName
   * Clear cache for specific tool
   */
  app.post('/performance/cache/clear/:toolName', async (request: any, reply: any) => {
    try {
      const { toolName } = request.params;
      await ToolCacheService.invalidateToolCache(toolName);
      reply.send({
        status: 'success',
        message: `Cache cleared for tool: ${toolName}`,
      });
    } catch (error) {
      console.error(`Failed to clear cache for ${request.params.toolName}:`, error);
      reply.code(500).send({ status: 'error', message: 'Failed to clear cache' });
    }
  });

  /**
   * POST /performance/cache/cleanup-expired
   * Remove expired cache entries
   */
  app.post('/performance/cache/cleanup-expired', async (request: any, reply: any) => {
    try {
      const removed = await ToolCacheService.cleanExpiredCaches();
      reply.send({
        status: 'success',
        message: `Cleaned ${removed} expired entries`,
      });
    } catch (error) {
      console.error('Failed to clean expired caches:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to clean expired caches' });
    }
  });

  /**
   * GET /performance/rag-indexing/stats/:sourceId
   * Get RAG incremental indexing statistics
   */
  app.get('/performance/rag-indexing/stats/:sourceId', async (request: any, reply: any) => {
    try {
      const { sourceId } = request.params;
      if (!isUuid(sourceId)) {
        return reply.code(400).send({ status: 'error', message: 'sourceId must be a valid UUID' });
      }
      const stats = await RAGIncrementalService.getIndexingStats(sourceId);
      reply.send({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      console.error('Failed to get RAG stats:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get RAG stats' });
    }
  });

  /**
   * GET /performance/rag-indexing/files/:sourceId
   * Get all files and their indexing status
   */
  app.get('/performance/rag-indexing/files/:sourceId', async (request: any, reply: any) => {
    try {
      const { sourceId } = request.params;
      if (!isUuid(sourceId)) {
        return reply.code(400).send({ status: 'error', message: 'sourceId must be a valid UUID' });
      }
      const files = await RAGIncrementalService.getSourceFiles(sourceId);
      reply.send({
        status: 'success',
        data: files,
      });
    } catch (error) {
      console.error('Failed to get source files:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get source files' });
    }
  });

  /**
   * GET /performance/inference/nodes
   * Get all inference nodes and their health
   */
  app.get('/performance/inference/nodes', async (request: any, reply: any) => {
    try {
      const nodes = await InferenceRoutingService.listInferenceNodes();
      reply.send({
        status: 'success',
        data: nodes,
      });
    } catch (error) {
      console.error('Failed to get inference nodes:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get inference nodes' });
    }
  });

  /**
   * GET /performance/inference/stats
   * Get inference routing statistics
   */
  app.get('/performance/inference/stats', async (request: any, reply: any) => {
    try {
      const stats = await InferenceRoutingService.getRoutingStats();
      reply.send({
        status: 'success',
        data: stats,
      });
    } catch (error) {
      console.error('Failed to get inference stats:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get inference stats' });
    }
  });

  /**
   * POST /performance/inference/route
   * Route a request to best available inference node
   */
  app.post('/performance/inference/route', async (request: any, reply: any) => {
    try {
      const { model } = request.body || {};
      if (!model) {
        return reply.code(400).send({ status: 'error', message: 'model parameter required' });
      }

      const decision = await InferenceRoutingService.routeInferenceRequest(model);
      reply.send({
        status: 'success',
        data: decision,
      });
    } catch (error) {
      console.error('Inference routing failed:', error);
      reply.code(500).send({ status: 'error', message: 'Inference routing failed' });
    }
  });

  /**
   * GET /performance/profiles
   * List all performance profiles
   */
  app.get('/performance/profiles', async (request: any, reply: any) => {
    try {
      const result = await pool.query(
        `SELECT id, profile_name, description, is_active,
                max_llm_concurrency, max_tool_concurrency, max_indexing_concurrency,
                llm_timeout_ms, tool_timeout_ms, indexing_timeout_ms,
                cache_enabled, cache_ttl_seconds, enable_buddy_mode, enable_rag, enable_workflows
         FROM performance_profiles
         ORDER BY profile_name`
      );

      reply.send({
        status: 'success',
        data: result.rows.map((r) => ({
          id: r.id,
          profileName: r.profile_name,
          description: r.description,
          isActive: r.is_active,
          limits: {
            maxLLMConcurrency: r.max_llm_concurrency,
            maxToolConcurrency: r.max_tool_concurrency,
            maxIndexingConcurrency: r.max_indexing_concurrency,
          },
          timeouts: {
            llmTimeoutMs: r.llm_timeout_ms,
            toolTimeoutMs: r.tool_timeout_ms,
            indexingTimeoutMs: r.indexing_timeout_ms,
          },
          cache: {
            enabled: r.cache_enabled,
            ttlSeconds: r.cache_ttl_seconds,
          },
          features: {
            buddyMode: r.enable_buddy_mode,
            rag: r.enable_rag,
            workflows: r.enable_workflows,
          },
        })),
      });
    } catch (error) {
      console.error('Failed to get profiles:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get profiles' });
    }
  });

  /**
   * PUT /performance/profiles/:profileName/activate
   * Activate a performance profile
   */
  app.put('/performance/profiles/:profileName/activate', async (request: any, reply: any) => {
    try {
      if (String((request as any).userRole || '').trim() !== 'platform_admin') {
        return reply.code(403).send({ status: 'error', message: 'Global profile activation requires platform admin role' });
      }
      const { profileName } = request.params;
      if (!isSlug(profileName)) {
        return reply.code(400).send({ status: 'error', message: 'profileName must be a valid slug' });
      }

      const activation = await setActivePerformanceProfile(pool, profileName);
      if (!activation.found) {
        return reply.code(404).send({ status: 'error', message: 'Profile not found' });
      }

      reply.send({
        status: 'success',
        message: `Profile '${profileName}' activated`,
      });
    } catch (error) {
      console.error('Failed to activate profile:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to activate profile' });
    }
  });

  /**
   * GET /performance/metrics/summary
   * Get overall performance metrics
   */
  app.get('/performance/metrics/summary', async (request: any, reply: any) => {
    try {
      const queueStatus = await PerformanceService.getQueueStatus();
      const backpressureStatus = await PerformanceService.getBackpressureStatus();
      const cacheStats = await ToolCacheService.getCacheStats();
      const inferenceStats = await InferenceRoutingService.getRoutingStats();

      reply.send({
        status: 'success',
        data: {
          queue: queueStatus,
          backpressure: backpressureStatus,
          cache: {
            totalRequests: cacheStats.reduce((sum: number, c: any) => sum + c.totalRequests, 0),
            cacheHitRate: cacheStats.length > 0 ? cacheStats.reduce((sum: number, c: any) => sum + c.hitRate, 0) / cacheStats.length : 0,
            toolStats: cacheStats,
          },
          inference: inferenceStats,
        },
      });
    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to get metrics summary' });
    }
  });

  /**
   * GET /performance/auto-tuning/suggestions
   * Analyze recent latency/error/load signals and suggest config/profile changes.
   */
  app.get('/performance/auto-tuning/suggestions', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const userId = String(request.userId || '');
      const windowHoursRaw = Number(request.query?.window_hours || 24);
      const windowHours = Number.isFinite(windowHoursRaw)
        ? Math.min(Math.max(Math.trunc(windowHoursRaw), 1), 24 * 30)
        : 24;

      let enabled = false;
      let latencyTargetMs = 900;
      let errorRateTargetPct = 5;
      try {
        const settingsRes = await pool.query(
          `SELECT key, value
           FROM settings_global
           WHERE key IN ('ai.autoTuning.enabled', 'ai.autoTuning.latencyTargetMs', 'ai.autoTuning.errorRateTargetPct')`,
        );
        const settings = new Map<string, unknown>();
        for (const row of settingsRes.rows) settings.set(String(row.key), row.value);
        const enabledRaw = settings.get('ai.autoTuning.enabled');
        enabled = enabledRaw === true || String(enabledRaw || '').toLowerCase() === 'true';
        const latencyRaw = Number(settings.get('ai.autoTuning.latencyTargetMs'));
        const errorRaw = Number(settings.get('ai.autoTuning.errorRateTargetPct'));
        if (Number.isFinite(latencyRaw) && latencyRaw > 0) latencyTargetMs = Math.trunc(latencyRaw);
        if (Number.isFinite(errorRaw) && errorRaw >= 0) errorRateTargetPct = Number(errorRaw.toFixed(2));
      } catch {
        enabled = false;
      }
      if (!enabled) {
        return reply.send({
          status: 'success',
          data: {
            enabled: false,
            window_hours: windowHours,
            suggestions: [],
            message: 'ai.autoTuning.enabled is false',
          },
        });
      }

      const queueAgg = await pool.query(
        `SELECT
           COALESCE(AVG(NULLIF(p95_processing_time_ms, 0)), 0)::numeric AS avg_p95_ms,
           COALESCE(MAX(depth_percentage), 0)::numeric AS max_depth_pct,
           COALESCE(AVG(NULLIF(error_rate, 0)), 0)::numeric AS avg_error_pct
         FROM queue_metrics
         WHERE sampled_at >= NOW() - ($1::int * INTERVAL '1 hour')`,
        [windowHours],
      );
      const q = queueAgg.rows[0] || {};
      const avgP95 = Number(q.avg_p95_ms || 0);
      const maxDepth = Number(q.max_depth_pct || 0);
      const avgError = Number(q.avg_error_pct || 0);

      const activeProfileRes = await pool.query(
        `SELECT profile_name
         FROM performance_profiles
         WHERE is_active = TRUE
         ORDER BY profile_name
         LIMIT 1`,
      );
      const activeProfile = String(activeProfileRes.rows[0]?.profile_name || 'unknown');

      const cacheStats = await ToolCacheService.getCacheStats().catch(() => []);
      const cacheHitRate = cacheStats.length > 0
        ? cacheStats.reduce((sum: number, c: any) => sum + Number(c.hitRate || 0), 0) / cacheStats.length
        : 0;

      const suggestions: Array<Record<string, unknown>> = [];

      if (avgP95 > latencyTargetMs) {
        suggestions.push({
          id: uuidv7(),
          category: 'latency',
          severity: avgP95 > latencyTargetMs * 1.5 ? 'high' : 'medium',
          title: 'Activate performance profile for lower latency',
          rationale: `Observed avg P95 ${Math.round(avgP95)}ms over ${windowHours}h exceeds target ${latencyTargetMs}ms.`,
          proposed_changes: {
            action: 'activate_profile',
            profile_name: 'performance',
            current_profile: activeProfile,
          },
        });
      }

      if (avgError > errorRateTargetPct) {
        suggestions.push({
          id: uuidv7(),
          category: 'error_rate',
          severity: avgError > errorRateTargetPct * 2 ? 'high' : 'medium',
          title: 'Stabilize runtime with balanced profile',
          rationale: `Observed avg error rate ${avgError.toFixed(2)}% over ${windowHours}h exceeds target ${errorRateTargetPct}%.`,
          proposed_changes: {
            action: 'activate_profile',
            profile_name: 'balanced',
            current_profile: activeProfile,
          },
        });
      }

      if (maxDepth >= 80) {
        suggestions.push({
          id: uuidv7(),
          category: 'queue_depth',
          severity: maxDepth >= 90 ? 'high' : 'medium',
          title: 'Queue pressure detected; reduce concurrency',
          rationale: `Queue depth peak ${maxDepth.toFixed(1)}% in last ${windowHours}h indicates saturation risk.`,
          proposed_changes: {
            action: 'adjust_limits',
            max_llm_concurrency_delta: -1,
            max_tool_concurrency_delta: -1,
          },
        });
      }

      if (cacheStats.length > 0 && cacheHitRate < 25) {
        suggestions.push({
          id: uuidv7(),
          category: 'cache_efficiency',
          severity: 'low',
          title: 'Improve cache hit rate on read-heavy tools',
          rationale: `Average tool cache hit rate is ${cacheHitRate.toFixed(1)}%, suggesting TTL/enablement tuning opportunity.`,
          proposed_changes: {
            action: 'review_cache_ttls',
            target_hit_rate_pct: 40,
          },
        });
      }

      try {
        for (const s of suggestions) {
          await pool.query(
            `INSERT INTO ai_auto_tuning_recommendations
               (id, organization_id, created_by, category, severity, title, rationale, proposed_changes, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'suggested', NOW())`,
            [
              String(s.id),
              orgId,
              userId,
              String(s.category),
              String(s.severity),
              String(s.title),
              String(s.rationale),
              JSON.stringify(s.proposed_changes || {}),
            ],
          );
        }
      } catch {
        // Keep endpoint resilient if schema is not yet migrated.
      }

      reply.send({
        status: 'success',
        data: {
          enabled: true,
          window_hours: windowHours,
          active_profile: activeProfile,
          observed: {
            avg_p95_ms: Math.round(avgP95),
            max_queue_depth_pct: Number(maxDepth.toFixed(2)),
            avg_error_rate_pct: Number(avgError.toFixed(2)),
            avg_cache_hit_rate_pct: Number(cacheHitRate.toFixed(2)),
          },
          targets: {
            latency_ms: latencyTargetMs,
            error_rate_pct: errorRateTargetPct,
          },
          suggestions,
        },
      });
    } catch (error) {
      console.error('Failed to generate auto-tuning suggestions:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to generate auto-tuning suggestions' });
    }
  });

  /**
   * POST /performance/auto-tuning/apply
   * Apply a limited subset of recommendation actions (profile activation).
   */
  app.post('/performance/auto-tuning/apply', async (request: any, reply: any) => {
    try {
      if (String(request.userRole || '') !== 'admin') {
        return reply.code(403).send({ status: 'error', message: 'Global profile activation requires platform admin role' });
      }

      const body = (request.body || {}) as { action?: string; profile_name?: string; recommendation_id?: string };
      const action = String(body.action || '').trim();
      if (action !== 'activate_profile') {
        return reply.code(400).send({ status: 'error', message: 'Unsupported action; use activate_profile' });
      }
      const profileName = String(body.profile_name || '').trim();
      if (!isSlug(profileName)) {
        return reply.code(400).send({ status: 'error', message: 'profile_name must be a valid slug' });
      }

      const activation = await setActivePerformanceProfile(pool, profileName);
      if (!activation.found) {
        return reply.code(404).send({ status: 'error', message: 'Profile not found' });
      }

      const recommendationId = String(body.recommendation_id || '').trim();
      const orgId = String(request.orgId || '');
      if (recommendationId) {
        await pool.query(
          `UPDATE ai_auto_tuning_recommendations
           SET status = 'applied', applied_at = NOW()
           WHERE id = $1 AND organization_id = $2`,
          [recommendationId, orgId],
        ).catch(() => {});
      }

      reply.send({
        status: 'success',
        data: {
          action: 'activate_profile',
          profile_name: profileName,
        },
      });
    } catch (error) {
      console.error('Failed to apply auto-tuning action:', error);
      reply.code(500).send({ status: 'error', message: 'Failed to apply auto-tuning action' });
    }
  });

  /**
   * GET /performance/context-window/suggestions
   * Learn per-user compaction threshold suggestions from conversation style.
   */
  app.get('/performance/context-window/suggestions', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const windowHoursRaw = Number(request.query?.window_hours || 168);
      const windowHours = Number.isFinite(windowHoursRaw)
        ? Math.min(Math.max(Math.trunc(windowHoursRaw), 24), 24 * 30)
        : 168;

      let enabled = false;
      let defaultThreshold = 80;
      try {
        const settingsRes = await pool.query(
          `SELECT key, value
           FROM settings_global
           WHERE key IN ('ai.contextWindowOptimization.enabled', 'ai.contextWindowOptimization.defaultThresholdPct')`,
        );
        const map = new Map<string, unknown>();
        for (const row of settingsRes.rows) map.set(String(row.key), row.value);
        const enabledRaw = map.get('ai.contextWindowOptimization.enabled');
        enabled = enabledRaw === true || String(enabledRaw || '').toLowerCase() === 'true';
        const thresholdRaw = Number(map.get('ai.contextWindowOptimization.defaultThresholdPct'));
        if (Number.isFinite(thresholdRaw)) {
          defaultThreshold = Math.min(95, Math.max(50, Math.trunc(thresholdRaw)));
        }
      } catch {
        enabled = false;
      }

      if (!enabled) {
        return reply.send({
          status: 'success',
          data: {
            enabled: false,
            window_hours: windowHours,
            suggestions: [],
            message: 'ai.contextWindowOptimization.enabled is false',
          },
        });
      }

      const usageRes = await pool.query(
        `SELECT
           m.sender_user_id AS user_id,
           COUNT(*)::int AS user_messages,
           COALESCE(AVG(CHAR_LENGTH(COALESCE(m.text, ''))), 0)::numeric AS avg_message_chars,
           COALESCE(COUNT(DISTINCT ce.id), 0)::int AS compactions,
           COALESCE(AVG(GREATEST(ce.before_tokens - ce.after_tokens, 0)), 0)::numeric AS avg_tokens_reduced
         FROM messages m
         JOIN chats c ON c.id = m.chat_id
         LEFT JOIN compaction_events ce
           ON ce.session_id = m.chat_id
          AND ce.created_at >= NOW() - ($2::int * INTERVAL '1 hour')
         WHERE c.organization_id = $1
           AND m.role = 'user'
           AND m.sender_user_id IS NOT NULL
           AND m.created_at >= NOW() - ($2::int * INTERVAL '1 hour')
         GROUP BY m.sender_user_id
         ORDER BY COUNT(*) DESC
         LIMIT 50`,
        [orgId, windowHours],
      );

      const suggestions: Array<Record<string, unknown>> = [];
      for (const row of usageRes.rows) {
        const userId = String(row.user_id || '').trim();
        if (!userId) continue;
        const userMessages = Number(row.user_messages || 0);
        const avgChars = Number(row.avg_message_chars || 0);
        const compactions = Number(row.compactions || 0);
        const avgReduced = Number(row.avg_tokens_reduced || 0);
        if (userMessages < 8) continue;

        let thresholdPct = defaultThreshold;
        let strategy: 'balanced' | 'aggressive' | 'conservative' = 'balanced';

        if (avgChars >= 280) {
          thresholdPct -= 10;
          strategy = 'aggressive';
        } else if (avgChars >= 180) {
          thresholdPct -= 5;
          strategy = 'aggressive';
        } else if (avgChars <= 70) {
          thresholdPct += 5;
          strategy = 'conservative';
        }

        const compactionsPer100 = userMessages > 0 ? (compactions / userMessages) * 100 : 0;
        if (compactionsPer100 >= 8) thresholdPct -= 5;
        if (compactionsPer100 <= 1 && avgReduced < 300) thresholdPct += 5;

        thresholdPct = Math.min(95, Math.max(50, Math.round(thresholdPct)));
        const rationale = `avg_message_chars=${avgChars.toFixed(1)}, compactions=${compactions}, compactions_per_100_msgs=${compactionsPer100.toFixed(2)}, avg_tokens_reduced=${avgReduced.toFixed(1)}`;
        const recommendationId = uuidv7();

        suggestions.push({
          id: recommendationId,
          user_id: userId,
          recommended_threshold_pct: thresholdPct,
          strategy,
          rationale,
          observed: {
            user_messages: userMessages,
            avg_message_chars: Number(avgChars.toFixed(2)),
            compactions,
            compactions_per_100_msgs: Number(compactionsPer100.toFixed(2)),
            avg_tokens_reduced: Number(avgReduced.toFixed(2)),
          },
        });

        try {
          await pool.query(
            `INSERT INTO ai_context_window_recommendations
               (id, organization_id, user_id, created_by, window_hours, observed_metrics,
                recommended_threshold_pct, strategy, rationale, status, created_at)
             VALUES
               ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 'suggested', NOW())`,
            [
              recommendationId,
              orgId,
              userId,
              adminUserId,
              windowHours,
              JSON.stringify({
                user_messages: userMessages,
                avg_message_chars: Number(avgChars.toFixed(2)),
                compactions,
                compactions_per_100_msgs: Number(compactionsPer100.toFixed(2)),
                avg_tokens_reduced: Number(avgReduced.toFixed(2)),
              }),
              thresholdPct,
              strategy,
              rationale,
            ],
          );
        } catch {
          // Keep analysis endpoint resilient when migration is not yet applied.
        }
      }

      return reply.send({
        status: 'success',
        data: {
          enabled: true,
          window_hours: windowHours,
          default_threshold_pct: defaultThreshold,
          suggestions,
        },
      });
    } catch (error) {
      console.error('Failed to generate context-window suggestions:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to generate context-window suggestions' });
    }
  });

  /**
   * POST /performance/context-window/apply
   * Apply context-window recommendation as user preference or global default.
   */
  app.post('/performance/context-window/apply', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as {
        recommendation_id?: string;
        target_user_id?: string;
        threshold_pct?: number;
        strategy?: string;
        apply_scope?: 'user';
      };

      const applyScopeRaw = String(body.apply_scope || 'user').trim().toLowerCase();
      if (applyScopeRaw !== 'user' && applyScopeRaw !== 'global') {
        return reply.code(400).send({ status: 'error', message: 'apply_scope must be user' });
      }
      const applyScope = applyScopeRaw as 'user' | 'global';
      if (applyScope === 'global') {
        return reply.code(403).send({
          status: 'error',
          message: 'Global context-window threshold mutation is not allowed from this endpoint',
        });
      }
      const recommendationId = String(body.recommendation_id || '').trim();

      let targetUserId = String(body.target_user_id || '').trim();
      let thresholdPct = Number(body.threshold_pct || 0);
      let strategy = String(body.strategy || 'balanced').trim().toLowerCase();

      if (recommendationId) {
        const recoRes = await pool.query(
          `SELECT user_id, recommended_threshold_pct, strategy
           FROM ai_context_window_recommendations
           WHERE id = $1
             AND organization_id = $2
           LIMIT 1`,
          [recommendationId, orgId],
        );
        if (recoRes.rows.length === 0) {
          return reply.code(404).send({ status: 'error', message: 'Recommendation not found' });
        }
        targetUserId = String(recoRes.rows[0].user_id || '');
        thresholdPct = Number(recoRes.rows[0].recommended_threshold_pct || thresholdPct);
        strategy = String(recoRes.rows[0].strategy || strategy || 'balanced');
      }

      thresholdPct = Math.min(95, Math.max(50, Math.trunc(thresholdPct)));
      if (!['aggressive', 'balanced', 'conservative'].includes(strategy)) {
        strategy = 'balanced';
      }

      if (!targetUserId) {
        return reply.code(400).send({ status: 'error', message: 'target_user_id is required for user scope' });
      }
      await pool.query(
        `INSERT INTO user_context_window_preferences
           (user_id, organization_id, threshold_pct, strategy, rationale, updated_by, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           threshold_pct = EXCLUDED.threshold_pct,
           strategy = EXCLUDED.strategy,
           rationale = EXCLUDED.rationale,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [targetUserId, orgId, thresholdPct, strategy, 'Applied from context-window optimization', adminUserId],
      );

      if (recommendationId) {
        await pool.query(
          `UPDATE ai_context_window_recommendations
           SET status = 'applied', applied_at = NOW()
           WHERE id = $1`,
          [recommendationId],
        ).catch(() => {});
      }

      return reply.send({
        status: 'success',
        data: {
          apply_scope: applyScope,
          target_user_id: applyScope === 'user' ? targetUserId : null,
          threshold_pct: thresholdPct,
          strategy,
        },
      });
    } catch (error) {
      console.error('Failed to apply context-window optimization:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to apply context-window optimization' });
    }
  });

  /**
   * GET /performance/tool-selection/suggestions
   * Learn preferred tools for similar intents from historical success rates.
   */
  app.get('/performance/tool-selection/suggestions', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const windowHoursRaw = Number(request.query?.window_hours || 168);
      const windowHours = Number.isFinite(windowHoursRaw)
        ? Math.min(Math.max(Math.trunc(windowHoursRaw), 24), 24 * 30)
        : 168;

      let enabled = false;
      let minSamples = 5;
      try {
        const settingsRes = await pool.query(
          `SELECT key, value
           FROM settings_global
           WHERE key IN ('ai.toolSelectionOptimization.enabled', 'ai.toolSelectionOptimization.minSamples')`,
        );
        const map = new Map<string, unknown>();
        for (const row of settingsRes.rows) map.set(String(row.key), row.value);
        const enabledRaw = map.get('ai.toolSelectionOptimization.enabled');
        enabled = enabledRaw === true || String(enabledRaw || '').toLowerCase() === 'true';
        const minSamplesRaw = Number(map.get('ai.toolSelectionOptimization.minSamples'));
        if (Number.isFinite(minSamplesRaw)) {
          minSamples = Math.min(100, Math.max(1, Math.trunc(minSamplesRaw)));
        }
      } catch {
        enabled = false;
      }

      if (!enabled) {
        return reply.send({
          status: 'success',
          data: {
            enabled: false,
            window_hours: windowHours,
            suggestions: [],
            message: 'ai.toolSelectionOptimization.enabled is false',
          },
        });
      }

      const rows = await pool.query(
        `SELECT
           LOWER(REGEXP_REPLACE(
             COALESCE(
               NULLIF(TRIM(tr.inputs->>'query'), ''),
               NULLIF(TRIM(tr.inputs->>'q'), ''),
               NULLIF(TRIM(tr.inputs->>'text'), ''),
               NULLIF(TRIM(tr.inputs->>'service'), ''),
               tr.tool_name
             ),
             '\\s+',
             ' ',
             'g'
           )) AS intent_key,
           tr.tool_name,
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE tr.status = 'success')::int AS success_runs,
           COALESCE(AVG(NULLIF(tr.duration_ms, 0)), 0)::numeric AS avg_duration_ms
         FROM tool_runs tr
         JOIN chats c ON c.id = tr.chat_id
         WHERE c.organization_id = $1
           AND tr.created_at >= NOW() - ($2::int * INTERVAL '1 hour')
         GROUP BY intent_key, tr.tool_name
         LIMIT 5000`,
        [orgId, windowHours],
      );

      const byIntent = new Map<string, Array<any>>();
      for (const row of rows.rows) {
        const intentKey = String(row.intent_key || '').trim().slice(0, 240);
        if (!intentKey) continue;
        const totalRuns = Number(row.total_runs || 0);
        if (totalRuns < minSamples) continue;
        const candidate = {
          tool_name: String(row.tool_name || ''),
          total_runs: totalRuns,
          success_runs: Number(row.success_runs || 0),
          success_rate_pct: totalRuns > 0 ? (Number(row.success_runs || 0) / totalRuns) * 100 : 0,
          avg_duration_ms: Number(row.avg_duration_ms || 0),
        };
        const existing = byIntent.get(intentKey) || [];
        existing.push(candidate);
        byIntent.set(intentKey, existing);
      }

      const MAX_TOOL_SUGGESTIONS = 500;
      const suggestions: Array<Record<string, unknown>> = [];
      for (const [intentKey, candidates] of byIntent.entries()) {
        if (suggestions.length >= MAX_TOOL_SUGGESTIONS) break;
        if (candidates.length === 0) continue;
        candidates.sort((a, b) => {
          if (b.success_rate_pct !== a.success_rate_pct) return b.success_rate_pct - a.success_rate_pct;
          if (a.avg_duration_ms !== b.avg_duration_ms) return a.avg_duration_ms - b.avg_duration_ms;
          return b.total_runs - a.total_runs;
        });
        const best = candidates[0];
        const confidence = Math.min(99, Math.max(0, Number((best.success_rate_pct * 0.8 + Math.min(best.total_runs, 20)).toFixed(2))));
        const suggestionId = uuidv7();
        const rationale = `Best tool by success rate for intent "${intentKey}" with ${best.success_runs}/${best.total_runs} successes at avg ${best.avg_duration_ms.toFixed(1)}ms.`;

        const suggestion = {
          id: suggestionId,
          intent_key: intentKey,
          candidate_tool_name: best.tool_name,
          confidence,
          rationale,
          observed_metrics: {
            best,
            alternatives: candidates.slice(1, 4),
            min_samples: minSamples,
          },
        };
        suggestions.push(suggestion);

        try {
          await pool.query(
            `INSERT INTO ai_tool_selection_recommendations
               (id, organization_id, created_by, intent_key, candidate_tool_name, confidence, observed_metrics, rationale, status, created_at)
             VALUES
               ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'suggested', NOW())`,
            [
              suggestionId,
              orgId,
              adminUserId,
              intentKey,
              best.tool_name,
              confidence,
              JSON.stringify(suggestion.observed_metrics || {}),
              rationale,
            ],
          );
        } catch {
          // keep endpoint resilient pre-migration
        }
      }

      return reply.send({
        status: 'success',
        data: {
          enabled: true,
          window_hours: windowHours,
          min_samples: minSamples,
          suggestions,
        },
      });
    } catch (error) {
      console.error('Failed to generate tool-selection suggestions:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to generate tool-selection suggestions' });
    }
  });

  /**
   * POST /performance/tool-selection/apply
   * Apply tool preference for an intent key.
   */
  app.post('/performance/tool-selection/apply', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as {
        recommendation_id?: string;
        intent_key?: string;
        tool_name?: string;
        confidence?: number;
      };

      const recommendationId = String(body.recommendation_id || '').trim();
      let intentKey = String(body.intent_key || '').trim();
      let toolName = String(body.tool_name || '').trim();
      let confidence = Number(body.confidence || 0);

      if (recommendationId) {
        const recoRes = await pool.query(
          `SELECT intent_key, candidate_tool_name, confidence
           FROM ai_tool_selection_recommendations
           WHERE id = $1
             AND organization_id = $2
           LIMIT 1`,
          [recommendationId, orgId],
        );
        if (recoRes.rows.length === 0) {
          return reply.code(404).send({ status: 'error', message: 'Recommendation not found' });
        }
        intentKey = String(recoRes.rows[0].intent_key || '');
        toolName = String(recoRes.rows[0].candidate_tool_name || '');
        confidence = Number(recoRes.rows[0].confidence || confidence || 0);
      }

      intentKey = intentKey.slice(0, 240);
      if (!intentKey || !toolName) {
        return reply.code(400).send({ status: 'error', message: 'intent_key and tool_name are required' });
      }
      confidence = Number.isFinite(confidence) ? Math.min(99, Math.max(0, Number(confidence.toFixed(2)))) : 0;

      await pool.query(
        `INSERT INTO ai_tool_selection_preferences
           (id, organization_id, intent_key, preferred_tool_name, confidence, rationale, source, updated_by, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, 'auto', $7, NOW(), NOW())
         ON CONFLICT (organization_id, intent_key)
         DO UPDATE SET
           preferred_tool_name = EXCLUDED.preferred_tool_name,
           confidence = EXCLUDED.confidence,
           rationale = EXCLUDED.rationale,
           source = EXCLUDED.source,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [
          uuidv7(),
          orgId,
          intentKey,
          toolName,
          confidence,
          `Applied tool preference for intent "${intentKey}"`,
          adminUserId,
        ],
      );

      if (recommendationId) {
        await pool.query(
          `UPDATE ai_tool_selection_recommendations
           SET status = 'applied', applied_at = NOW()
           WHERE id = $1`,
          [recommendationId],
        ).catch(() => {});
      }

      return reply.send({
        status: 'success',
        data: {
          intent_key: intentKey,
          preferred_tool_name: toolName,
          confidence,
        },
      });
    } catch (error) {
      console.error('Failed to apply tool-selection preference:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to apply tool-selection preference' });
    }
  });

  /**
   * POST /performance/prompt-refinement/experiments
   * Create a prompt A/B experiment.
   */
  app.post('/performance/prompt-refinement/experiments', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as {
        name?: string;
        description?: string;
        metric_name?: string;
        base_prompt?: string;
        variant_a_prompt?: string;
        variant_b_prompt?: string;
        target_sample_size?: number;
      };

      const name = String(body.name || '').trim().slice(0, 240);
      const basePrompt = String(body.base_prompt || '').trim();
      const variantAPrompt = String(body.variant_a_prompt || '').trim();
      const variantBPrompt = String(body.variant_b_prompt || '').trim();
      if (!name || !variantAPrompt || !variantBPrompt) {
        return reply.code(400).send({
          status: 'error',
          message: 'name, variant_a_prompt, and variant_b_prompt are required',
        });
      }
      const metricName = String(body.metric_name || 'quality_score').trim().slice(0, 80) || 'quality_score';
      const targetSampleSizeRaw = Number(body.target_sample_size || 100);
      const targetSampleSize = Number.isFinite(targetSampleSizeRaw)
        ? Math.min(100000, Math.max(10, Math.trunc(targetSampleSizeRaw)))
        : 100;

      const experimentId = uuidv7();
      await pool.query(
        `INSERT INTO ai_prompt_experiments
           (id, organization_id, created_by, name, description, metric_name, status,
            base_prompt, variant_a_prompt, variant_b_prompt, target_sample_size, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, NOW(), NOW())`,
        [
          experimentId,
          orgId,
          adminUserId,
          name,
          String(body.description || '').slice(0, 2000),
          metricName,
          basePrompt,
          variantAPrompt,
          variantBPrompt,
          targetSampleSize,
        ],
      );

      return reply.send({
        status: 'success',
        data: {
          experiment_id: experimentId,
          name,
          metric_name: metricName,
          target_sample_size: targetSampleSize,
          status: 'active',
        },
      });
    } catch (error) {
      console.error('Failed to create prompt refinement experiment:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to create prompt refinement experiment' });
    }
  });

  /**
   * POST /performance/prompt-refinement/assign
   * Deterministically assign a chat/user to variant A or B and log run row.
   */
  app.post('/performance/prompt-refinement/assign', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as {
        experiment_id?: string;
        chat_id?: string;
        user_id?: string;
        response_message_id?: string;
        latency_ms?: number;
        metadata?: Record<string, unknown>;
      };
      const experimentId = String(body.experiment_id || '').trim();
      if (!experimentId) {
        return reply.code(400).send({ status: 'error', message: 'experiment_id is required' });
      }
      const chatId = String(body.chat_id || '').trim();
      const userId = String(body.user_id || adminUserId).trim();
      const bucketKey = `${experimentId}:${chatId || 'no-chat'}:${userId || 'no-user'}`;
      const digest = createHash('sha1').update(bucketKey).digest('hex');
      const variant: 'a' | 'b' = (parseInt(digest.slice(0, 2), 16) % 2 === 0) ? 'a' : 'b';

      const expRes = await pool.query(
        `SELECT id, variant_a_prompt, variant_b_prompt, base_prompt, status
         FROM ai_prompt_experiments
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [experimentId, orgId],
      );
      if (expRes.rows.length === 0) {
        return reply.code(404).send({ status: 'error', message: 'Experiment not found' });
      }
      if (String(expRes.rows[0].status || '') !== 'active') {
        return reply.code(409).send({ status: 'error', message: 'Experiment is not active' });
      }
      const chosenPrompt = variant === 'a'
        ? String(expRes.rows[0].variant_a_prompt || '')
        : String(expRes.rows[0].variant_b_prompt || '');
      const promptHash = createHash('sha256')
        .update(`${String(expRes.rows[0].base_prompt || '')}\n${chosenPrompt}`)
        .digest('hex');

      const runId = uuidv7();
      const latencyMsRaw = Number(body.latency_ms || 0);
      const latencyMs = Number.isFinite(latencyMsRaw) ? Math.max(0, Math.trunc(latencyMsRaw)) : 0;
      await pool.query(
        `INSERT INTO ai_prompt_experiment_runs
           (id, experiment_id, organization_id, chat_id, user_id, variant, prompt_hash,
            response_message_id, latency_ms, metadata, created_at)
         VALUES
           ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, NULLIF($8, ''), $9, $10::jsonb, NOW())`,
        [
          runId,
          experimentId,
          orgId,
          chatId,
          userId,
          variant,
          promptHash,
          String(body.response_message_id || ''),
          latencyMs,
          JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        ],
      );

      return reply.send({
        status: 'success',
        data: {
          run_id: runId,
          experiment_id: experimentId,
          variant,
          prompt: chosenPrompt,
          prompt_hash: promptHash,
        },
      });
    } catch (error) {
      console.error('Failed to assign prompt variant:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to assign prompt variant' });
    }
  });

  /**
   * POST /performance/prompt-refinement/feedback
   * Record quality score feedback for an experiment run.
   */
  app.post('/performance/prompt-refinement/feedback', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const body = (request.body || {}) as { run_id?: string; quality_score?: number };
      const runId = String(body.run_id || '').trim();
      if (!runId) {
        return reply.code(400).send({ status: 'error', message: 'run_id is required' });
      }
      const scoreRaw = Number(body.quality_score);
      if (!Number.isFinite(scoreRaw)) {
        return reply.code(400).send({ status: 'error', message: 'quality_score must be numeric' });
      }
      const score = Math.min(100, Math.max(0, Number(scoreRaw.toFixed(3))));
      const updated = await pool.query(
        `UPDATE ai_prompt_experiment_runs
         SET quality_score = $1
         WHERE id = $2
           AND organization_id = $3
         RETURNING id`,
        [score, runId, orgId],
      );
      if (!updated.rows.length) {
        return reply.code(404).send({ status: 'error', message: 'Run not found' });
      }
      return reply.send({ status: 'success', data: { run_id: runId, quality_score: score } });
    } catch (error) {
      console.error('Failed to record prompt refinement feedback:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to record prompt refinement feedback' });
    }
  });

  /**
   * GET /performance/prompt-refinement/experiments/:id/summary
   * Summarize variant performance and winner by quality score (fallback latency).
   */
  app.get('/performance/prompt-refinement/experiments/:id/summary', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const experimentId = String(request.params?.id || '').trim();
      if (!experimentId) {
        return reply.code(400).send({ status: 'error', message: 'experiment id is required' });
      }

      const expRes = await pool.query(
        `SELECT id, name, metric_name, status, target_sample_size, created_at
         FROM ai_prompt_experiments
         WHERE id = $1
           AND organization_id = $2
         LIMIT 1`,
        [experimentId, orgId],
      );
      if (!expRes.rows.length) {
        return reply.code(404).send({ status: 'error', message: 'Experiment not found' });
      }

      const agg = await pool.query(
        `SELECT
           variant,
           COUNT(*)::int AS samples,
           COALESCE(AVG(quality_score), 0)::numeric AS avg_quality,
           COALESCE(AVG(NULLIF(latency_ms, 0)), 0)::numeric AS avg_latency_ms
         FROM ai_prompt_experiment_runs
         WHERE experiment_id = $1
         GROUP BY variant`,
        [experimentId],
      );
      const byVariant: Record<string, { samples: number; avg_quality: number; avg_latency_ms: number }> = {
        a: { samples: 0, avg_quality: 0, avg_latency_ms: 0 },
        b: { samples: 0, avg_quality: 0, avg_latency_ms: 0 },
      };
      for (const row of agg.rows) {
        const key = String(row.variant || '').toLowerCase();
        if (key !== 'a' && key !== 'b') continue;
        byVariant[key] = {
          samples: Number(row.samples || 0),
          avg_quality: Number(row.avg_quality || 0),
          avg_latency_ms: Number(row.avg_latency_ms || 0),
        };
      }

      let winner: 'a' | 'b' | 'tie' = 'tie';
      if (byVariant.a.samples > 0 || byVariant.b.samples > 0) {
        if (byVariant.a.avg_quality > byVariant.b.avg_quality) winner = 'a';
        else if (byVariant.b.avg_quality > byVariant.a.avg_quality) winner = 'b';
        else if (byVariant.a.avg_latency_ms > 0 || byVariant.b.avg_latency_ms > 0) {
          if (byVariant.a.avg_latency_ms < byVariant.b.avg_latency_ms) winner = 'a';
          else if (byVariant.b.avg_latency_ms < byVariant.a.avg_latency_ms) winner = 'b';
        }
      }

      return reply.send({
        status: 'success',
        data: {
          experiment: expRes.rows[0],
          variants: byVariant,
          winner,
        },
      });
    } catch (error) {
      console.error('Failed to summarize prompt refinement experiment:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to summarize prompt refinement experiment' });
    }
  });

  /**
   * POST /performance/resource-optimization/rules
   * Create resource optimization rule for profile auto-switching.
   */
  app.post('/performance/resource-optimization/rules', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as {
        name?: string;
        priority?: number;
        rule_type?: 'time_window' | 'queue_pressure';
        target_profile_name?: string;
        start_hour_utc?: number;
        end_hour_utc?: number;
        queue_depth_pct_threshold?: number;
        enabled?: boolean;
        metadata?: Record<string, unknown>;
      };

      const name = String(body.name || '').trim().slice(0, 200);
      const ruleType = String(body.rule_type || '').trim();
      const targetProfile = String(body.target_profile_name || '').trim();
      if (!name || !targetProfile || (ruleType !== 'time_window' && ruleType !== 'queue_pressure')) {
        return reply.code(400).send({
          status: 'error',
          message: 'name, target_profile_name, and valid rule_type are required',
        });
      }
      if (!isSlug(targetProfile)) {
        return reply.code(400).send({ status: 'error', message: 'target_profile_name must be a valid slug' });
      }

      const profileExists = await pool.query(
        `SELECT 1 FROM performance_profiles WHERE profile_name = $1 LIMIT 1`,
        [targetProfile],
      );
      if (!profileExists.rows.length) {
        return reply.code(404).send({ status: 'error', message: 'Target profile not found' });
      }

      const priorityRaw = Number(body.priority || 100);
      const priority = Number.isFinite(priorityRaw) ? Math.max(1, Math.min(10000, Math.trunc(priorityRaw))) : 100;
      const enabledParsed = parseOptionalBoolean((body as { enabled?: unknown }).enabled);
      if (!enabledParsed.valid) {
        return reply.code(400).send({
          status: 'error',
          message: 'enabled must be a boolean when provided',
        });
      }
      const enabled = enabledParsed.value ?? true;
      const startHourRaw = Number(body.start_hour_utc);
      const endHourRaw = Number(body.end_hour_utc);
      const queueThresholdRaw = Number(body.queue_depth_pct_threshold);
      const startHour = Number.isFinite(startHourRaw) ? Math.max(0, Math.min(23, Math.trunc(startHourRaw))) : null;
      const endHour = Number.isFinite(endHourRaw) ? Math.max(0, Math.min(23, Math.trunc(endHourRaw))) : null;
      const queueThreshold = Number.isFinite(queueThresholdRaw)
        ? Number(Math.max(0, Math.min(100, queueThresholdRaw)).toFixed(2))
        : null;

      if (ruleType === 'time_window' && (startHour === null || endHour === null)) {
        return reply.code(400).send({
          status: 'error',
          message: 'start_hour_utc and end_hour_utc are required for time_window rules',
        });
      }
      if (ruleType === 'queue_pressure' && queueThreshold === null) {
        return reply.code(400).send({
          status: 'error',
          message: 'queue_depth_pct_threshold is required for queue_pressure rules',
        });
      }

      const id = uuidv7();
      await pool.query(
        `INSERT INTO ai_resource_profile_rules
           (id, organization_id, name, enabled, priority, rule_type, target_profile_name,
            start_hour_utc, end_hour_utc, queue_depth_pct_threshold, metadata, created_by, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW(), NOW())`,
        [
          id,
          orgId,
          name,
          enabled,
          priority,
          ruleType,
          targetProfile,
          startHour,
          endHour,
          queueThreshold,
          JSON.stringify(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
          adminUserId,
        ],
      );

      return reply.send({
        status: 'success',
        data: {
          id,
          name,
          enabled,
          priority,
          rule_type: ruleType,
          target_profile_name: targetProfile,
          start_hour_utc: startHour,
          end_hour_utc: endHour,
          queue_depth_pct_threshold: queueThreshold,
        },
      });
    } catch (error) {
      console.error('Failed to create resource optimization rule:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to create resource optimization rule' });
    }
  });

  /**
   * GET /performance/resource-optimization/rules
   * List profile auto-switching rules.
   */
  app.get('/performance/resource-optimization/rules', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const res = await pool.query(
        `SELECT id, name, enabled, priority, rule_type, target_profile_name,
                start_hour_utc, end_hour_utc, queue_depth_pct_threshold, metadata, created_at, updated_at
         FROM ai_resource_profile_rules
         WHERE organization_id = $1
         ORDER BY enabled DESC, priority ASC, created_at DESC`,
        [orgId],
      );
      return reply.send({ status: 'success', data: res.rows });
    } catch (error) {
      console.error('Failed to list resource optimization rules:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to list resource optimization rules' });
    }
  });

  /**
   * POST /performance/resource-optimization/evaluate
   * Evaluate active rules and optionally switch active profile.
   */
  app.post('/performance/resource-optimization/evaluate', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as { dry_run?: boolean };
      const dryRun = body.dry_run !== false;

      let enabled = false;
      try {
        const enabledRes = await pool.query(
          `SELECT value
           FROM settings_global
           WHERE key = 'ai.resourceOptimization.enabled'
           LIMIT 1`,
        );
        const raw = enabledRes.rows[0]?.value;
        enabled = raw === true || String(raw || '').toLowerCase() === 'true';
      } catch {
        enabled = false;
      }
      if (!enabled) {
        return reply.send({
          status: 'success',
          data: { enabled: false, dry_run: dryRun, matched_rule: null, switched: false },
        });
      }

      const nowHourUtc = new Date().getUTCHours();
      const queueRes = await pool.query(
        `SELECT COALESCE(MAX(depth_percentage), 0)::numeric AS max_depth_pct
         FROM queue_metrics
         WHERE sampled_at >= NOW() - INTERVAL '30 minutes'`,
      );
      const maxDepthPct = Number(queueRes.rows[0]?.max_depth_pct || 0);

      const rulesRes = await pool.query(
        `SELECT id, name, priority, rule_type, target_profile_name,
                start_hour_utc, end_hour_utc, queue_depth_pct_threshold
         FROM ai_resource_profile_rules
         WHERE organization_id = $1
           AND enabled = TRUE
         ORDER BY priority ASC, created_at DESC`,
        [orgId],
      );

      let matchedRule: any = null;
      for (const rule of rulesRes.rows) {
        if (String(rule.rule_type) === 'time_window') {
          const startHour = Number(rule.start_hour_utc);
          const endHour = Number(rule.end_hour_utc);
          if (Number.isFinite(startHour) && Number.isFinite(endHour)) {
            const inWindow = startHour <= endHour
              ? nowHourUtc >= startHour && nowHourUtc <= endHour
              : nowHourUtc >= startHour || nowHourUtc <= endHour;
            if (inWindow) {
              matchedRule = rule;
              break;
            }
          }
        } else if (String(rule.rule_type) === 'queue_pressure') {
          const threshold = Number(rule.queue_depth_pct_threshold || 0);
          if (maxDepthPct >= threshold) {
            matchedRule = rule;
            break;
          }
        }
      }

      const activeProfileRes = await pool.query(
        `SELECT profile_name
         FROM performance_profiles
         WHERE is_active = TRUE
         ORDER BY profile_name
         LIMIT 1`,
      );
      const activeProfile = String(activeProfileRes.rows[0]?.profile_name || '');
      const targetProfile = matchedRule ? String(matchedRule.target_profile_name || '') : '';
      const shouldSwitch = Boolean(matchedRule && targetProfile && targetProfile !== activeProfile);

      if (shouldSwitch && !dryRun && String(request.userRole || '') !== 'admin') {
        return reply.code(403).send({
          status: 'error',
          message: 'Global profile switching requires platform admin role',
        });
      }

      if (shouldSwitch && !dryRun) {
        const activation = await setActivePerformanceProfile(pool, targetProfile);
        if (!activation.found) {
          return reply.code(404).send({ status: 'error', message: 'Target profile not found' });
        }
        await pool.query(
          `INSERT INTO ai_resource_profile_switch_events
             (id, organization_id, rule_id, previous_profile_name, next_profile_name, reason, observed_metrics, created_by, created_at)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())`,
          [
            uuidv7(),
            orgId,
            String(matchedRule.id || ''),
            activeProfile || null,
            targetProfile,
            `rule:${String(matchedRule.rule_type)}:${String(matchedRule.name || '')}`,
            JSON.stringify({ now_hour_utc: nowHourUtc, max_queue_depth_pct_30m: Number(maxDepthPct.toFixed(2)) }),
            adminUserId,
          ],
        );
      }

      return reply.send({
        status: 'success',
        data: {
          enabled: true,
          dry_run: dryRun,
          observed: {
            now_hour_utc: nowHourUtc,
            max_queue_depth_pct_30m: Number(maxDepthPct.toFixed(2)),
          },
          active_profile: activeProfile || null,
          matched_rule: matchedRule
            ? {
              id: String(matchedRule.id),
              name: String(matchedRule.name || ''),
              rule_type: String(matchedRule.rule_type || ''),
              target_profile_name: targetProfile,
              priority: Number(matchedRule.priority || 0),
            }
            : null,
          switched: shouldSwitch && !dryRun,
          target_profile_name: shouldSwitch ? targetProfile : activeProfile || null,
        },
      });
    } catch (error) {
      console.error('Failed to evaluate resource optimization rules:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to evaluate resource optimization rules' });
    }
  });

  /**
   * POST /performance/ai-ops/weekly-report/generate
   * Generate and persist weekly AI operations summary.
   */
  app.post('/performance/ai-ops/weekly-report/generate', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const adminUserId = String(request.userId || '');
      const body = (request.body || {}) as { window_days?: number };

      let enabled = false;
      let defaultWindowDays = 7;
      try {
        const settingsRes = await pool.query(
          `SELECT key, value
           FROM settings_global
           WHERE key IN ('ai.opsWeeklyReport.enabled', 'ai.opsWeeklyReport.defaultWindowDays')`,
        );
        const map = new Map<string, unknown>();
        for (const row of settingsRes.rows) map.set(String(row.key), row.value);
        const enabledRaw = map.get('ai.opsWeeklyReport.enabled');
        enabled = enabledRaw === true || String(enabledRaw || '').toLowerCase() === 'true';
        const daysRaw = Number(map.get('ai.opsWeeklyReport.defaultWindowDays'));
        if (Number.isFinite(daysRaw)) {
          defaultWindowDays = Math.max(1, Math.min(30, Math.trunc(daysRaw)));
        }
      } catch {
        enabled = false;
      }
      if (!enabled) {
        return reply.send({
          status: 'success',
          data: { enabled: false, message: 'ai.opsWeeklyReport.enabled is false' },
        });
      }

      const windowDaysRaw = Number(body.window_days || defaultWindowDays);
      const windowDays = Number.isFinite(windowDaysRaw)
        ? Math.max(1, Math.min(30, Math.trunc(windowDaysRaw)))
        : defaultWindowDays;

      const currentQueue = await pool.query(
        `SELECT
           COALESCE(AVG(NULLIF(p95_processing_time_ms, 0)), 0)::numeric AS avg_p95_ms,
           COALESCE(AVG(NULLIF(error_rate, 0)), 0)::numeric AS avg_error_pct,
           COALESCE(MAX(depth_percentage), 0)::numeric AS peak_depth_pct
         FROM queue_metrics
         WHERE sampled_at >= NOW() - ($1::int * INTERVAL '1 day')`,
        [windowDays],
      );
      const previousQueue = await pool.query(
        `SELECT
           COALESCE(AVG(NULLIF(p95_processing_time_ms, 0)), 0)::numeric AS avg_p95_ms,
           COALESCE(AVG(NULLIF(error_rate, 0)), 0)::numeric AS avg_error_pct,
           COALESCE(MAX(depth_percentage), 0)::numeric AS peak_depth_pct
         FROM queue_metrics
         WHERE sampled_at < NOW() - ($1::int * INTERVAL '1 day')
           AND sampled_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [windowDays, windowDays * 2],
      );

      const currentTools = await pool.query(
        `SELECT
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE tr.status = 'success')::int AS success_runs
         FROM tool_runs tr
         JOIN chats c ON c.id = tr.chat_id
         WHERE c.organization_id = $1
           AND tr.created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [orgId, windowDays],
      );
      const previousTools = await pool.query(
        `SELECT
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE tr.status = 'success')::int AS success_runs
         FROM tool_runs tr
         JOIN chats c ON c.id = tr.chat_id
         WHERE c.organization_id = $1
           AND tr.created_at < NOW() - ($2::int * INTERVAL '1 day')
           AND tr.created_at >= NOW() - ($3::int * INTERVAL '1 day')`,
        [orgId, windowDays, windowDays * 2],
      );

      const currentPrompt = await pool.query(
        `SELECT
           COUNT(*)::int AS graded_runs,
           COALESCE(AVG(quality_score), 0)::numeric AS avg_quality
         FROM ai_prompt_experiment_runs
         WHERE organization_id = $1
           AND created_at >= NOW() - ($2::int * INTERVAL '1 day')`,
        [orgId, windowDays],
      );
      const previousPrompt = await pool.query(
        `SELECT
           COUNT(*)::int AS graded_runs,
           COALESCE(AVG(quality_score), 0)::numeric AS avg_quality
         FROM ai_prompt_experiment_runs
         WHERE organization_id = $1
           AND created_at < NOW() - ($2::int * INTERVAL '1 day')
           AND created_at >= NOW() - ($3::int * INTERVAL '1 day')`,
        [orgId, windowDays, windowDays * 2],
      );

      const cq = currentQueue.rows[0] || {};
      const pq = previousQueue.rows[0] || {};
      const ct = currentTools.rows[0] || {};
      const pt = previousTools.rows[0] || {};
      const cp = currentPrompt.rows[0] || {};
      const pp = previousPrompt.rows[0] || {};

      const currentToolSuccess = Number(ct.total_runs || 0) > 0
        ? (Number(ct.success_runs || 0) / Number(ct.total_runs || 0)) * 100
        : 0;
      const previousToolSuccess = Number(pt.total_runs || 0) > 0
        ? (Number(pt.success_runs || 0) / Number(pt.total_runs || 0)) * 100
        : 0;

      const summary = {
        window_days: windowDays,
        metrics: {
          queue: {
            avg_p95_ms: Number(Number(cq.avg_p95_ms || 0).toFixed(2)),
            avg_error_pct: Number(Number(cq.avg_error_pct || 0).toFixed(2)),
            peak_depth_pct: Number(Number(cq.peak_depth_pct || 0).toFixed(2)),
          },
          tools: {
            total_runs: Number(ct.total_runs || 0),
            success_rate_pct: Number(currentToolSuccess.toFixed(2)),
          },
          prompt_refinement: {
            graded_runs: Number(cp.graded_runs || 0),
            avg_quality_score: Number(Number(cp.avg_quality || 0).toFixed(3)),
          },
        },
        deltas_vs_previous_window: {
          queue_avg_p95_ms: Number((Number(cq.avg_p95_ms || 0) - Number(pq.avg_p95_ms || 0)).toFixed(2)),
          queue_avg_error_pct: Number((Number(cq.avg_error_pct || 0) - Number(pq.avg_error_pct || 0)).toFixed(2)),
          tool_success_rate_pct: Number((currentToolSuccess - previousToolSuccess).toFixed(2)),
          prompt_avg_quality_score: Number((Number(cp.avg_quality || 0) - Number(pp.avg_quality || 0)).toFixed(3)),
        },
      };

      const improved: string[] = [];
      const degraded: string[] = [];
      const recommendations: string[] = [];

      if (summary.deltas_vs_previous_window.queue_avg_p95_ms < -50) improved.push('Queue p95 latency improved');
      if (summary.deltas_vs_previous_window.queue_avg_error_pct < -0.5) improved.push('Queue error rate improved');
      if (summary.deltas_vs_previous_window.tool_success_rate_pct > 2) improved.push('Tool success rate improved');
      if (summary.deltas_vs_previous_window.prompt_avg_quality_score > 1) improved.push('Prompt quality improved');

      if (summary.deltas_vs_previous_window.queue_avg_p95_ms > 50) degraded.push('Queue p95 latency degraded');
      if (summary.deltas_vs_previous_window.queue_avg_error_pct > 0.5) degraded.push('Queue error rate degraded');
      if (summary.deltas_vs_previous_window.tool_success_rate_pct < -2) degraded.push('Tool success rate degraded');
      if (summary.deltas_vs_previous_window.prompt_avg_quality_score < -1) degraded.push('Prompt quality degraded');

      if (summary.metrics.queue.peak_depth_pct >= 85) {
        recommendations.push('Enable or tune resource optimization rules for queue-pressure profile switching.');
      }
      if (summary.metrics.tools.success_rate_pct < 85) {
        recommendations.push('Review tool-selection recommendations and apply top confidence preferences.');
      }
      if (summary.metrics.prompt_refinement.graded_runs < 20) {
        recommendations.push('Increase prompt A/B experiment traffic or feedback collection volume.');
      }
      if (recommendations.length === 0) {
        recommendations.push('No urgent action required; continue monitoring weekly trends.');
      }

      const narrative = [
        `Weekly AI ops summary for ${windowDays} day window.`,
        improved.length ? `Improved: ${improved.join('; ')}.` : 'Improved: none material.',
        degraded.length ? `Degraded: ${degraded.join('; ')}.` : 'Degraded: none material.',
        `Recommendations: ${recommendations.join(' ')}`,
      ].join(' ');

      const reportId = uuidv7();
      await pool.query(
        `INSERT INTO ai_ops_weekly_reports
           (id, organization_id, created_by, window_days, report_date, summary, narrative, created_at)
         VALUES
           ($1, $2, $3, $4, CURRENT_DATE, $5::jsonb, $6, NOW())`,
        [reportId, orgId, adminUserId, windowDays, JSON.stringify({
          ...summary,
          improved,
          degraded,
          recommendations,
        }), narrative],
      );

      return reply.send({
        status: 'success',
        data: {
          report_id: reportId,
          summary: {
            ...summary,
            improved,
            degraded,
            recommendations,
          },
          narrative,
        },
      });
    } catch (error) {
      console.error('Failed to generate weekly AI ops report:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to generate weekly AI ops report' });
    }
  });

  /**
   * GET /performance/ai-ops/weekly-report
   * List recent weekly AI operations reports.
   */
  app.get('/performance/ai-ops/weekly-report', async (request: any, reply: any) => {
    try {
      const orgId = String(request.orgId || '');
      const limitRaw = Number(request.query?.limit || 12);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(52, Math.trunc(limitRaw))) : 12;
      const res = await pool.query(
        `SELECT id, window_days, report_date, summary, narrative, created_at
         FROM ai_ops_weekly_reports
         WHERE organization_id = $1
         ORDER BY report_date DESC, created_at DESC
         LIMIT $2`,
        [orgId, limit],
      );
      return reply.send({ status: 'success', data: res.rows });
    } catch (error) {
      console.error('Failed to list weekly AI ops reports:', error);
      return reply.code(500).send({ status: 'error', message: 'Failed to list weekly AI ops reports' });
    }
  });

  /**
   * POST /performance/health-check
   * Run immediate health check
   */
  app.post('/performance/health-check', async (request: any, reply: any) => {
    try {
      await PerformanceService.performHealthCheck();
      reply.send({
        status: 'success',
        message: 'Health check completed',
      });
    } catch (error) {
      console.error('Health check failed:', error);
      reply.code(500).send({ status: 'error', message: 'Health check failed' });
    }
  });
}

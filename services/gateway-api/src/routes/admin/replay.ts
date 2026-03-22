import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import * as ReplayService from '../../services/ReplayService.js';
import * as ScenarioService from '../../services/ScenarioService.js';
import { isUuid } from '../../lib/input-validation.js';

function sendReplayInternalError(reply: any, publicMessage: string) {
  return reply.code(500).send({
    status: 'error',
    code: 'REPLAY_INTERNAL_ERROR',
    message: publicMessage,
  });
}

function requireGlobalAdmin(request: any, reply: any): boolean {
  if (String(request.userRole || '').trim() === 'platform_admin') return true;
  reply.code(403).send({
    status: 'error',
    code: 'FORBIDDEN',
    message: 'Global admin privileges required',
  });
  return false;
}

function currentOrgId(request: any): string | null {
  const orgId = String(request?.orgId || '').trim();
  return orgId || null;
}

function currentActorUserId(request: any): string | null {
  const userId = String(request?.user?.id || request?.userId || '').trim();
  return userId || null;
}

/**
 * Register replay testing routes
 */
export async function registerReplayRoutes(app: FastifyInstance, pool: Pool) {
  function parseReplayRunsLimit(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') return 50;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      return null;
    }
    return Math.min(parsed, 200);
  }

  function normalizeReplayBody(raw: unknown): Record<string, unknown> | null {
    if (raw === undefined) return {};
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
  }

  // ============= SCENARIO MANAGEMENT =============

  /**
   * POST /replay/scenario
   * Create a new test scenario
   */
  app.post('/replay/scenario', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    const actorUserId = currentActorUserId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    if (!actorUserId) {
      return reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authenticated user required' });
    }
    try {
      const body = normalizeReplayBody(request.body);
      if (!body) {
        return reply.code(400).send({ status: 'error', code: 'VALIDATION_ERROR', message: 'request body must be a JSON object' });
      }
      const { name, description, category, chatId, userMessage, expectedAssistantResponse, expectedToolCalls, expectedApprovalsRequired, tags, priority } = body as any;

      if (!name || !chatId || !userMessage) {
        return reply.code(400).send({ status: 'error', message: 'name, chatId, and userMessage required' });
      }
      const chatOwnership = await pool.query(
        `SELECT id FROM chats WHERE id::text = $1::text AND organization_id::text = $2::text`,
        [chatId, orgId],
      );
      if (chatOwnership.rows.length === 0) {
        return reply.code(403).send({ status: 'error', code: 'FORBIDDEN', message: 'chatId is not in active organization' });
      }

      const userId = (request as any).userId || 'system';
      const scenario = await ScenarioService.createScenario(
        name,
        description,
        category,
        chatId,
        orgId,
        actorUserId,
        userMessage,
        expectedAssistantResponse,
        expectedToolCalls,
        expectedApprovalsRequired,
        tags,
        priority
      );

      return reply.send({
        status: 'ok',
        data: scenario,
      });
    } catch (error) {
      console.error('POST /replay/scenario error:', error);
      return sendReplayInternalError(reply, 'Failed to create scenario');
    }
  });

  /**
   * GET /replay/scenarios
   * List all scenarios
   */
  app.get('/replay/scenarios', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const query = (request as any).query || {};
      const category = query.category;
      const activeOnly = query.activeOnly !== 'false';

      const scenarios = await ScenarioService.getAllScenarios(category, activeOnly, orgId);

      return reply.send({
        status: 'ok',
        data: scenarios,
      });
    } catch (error) {
      console.error('GET /replay/scenarios error:', error);
      return sendReplayInternalError(reply, 'Failed to list scenarios');
    }
  });

  /**
   * GET /replay/scenarios/categories
   * List all scenario categories
   */
  app.get('/replay/scenarios/categories', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const categories = await ScenarioService.getScenarioCategories(orgId);

      return reply.send({
        status: 'ok',
        data: categories,
      });
    } catch (error) {
      console.error('GET /replay/scenarios/categories error:', error);
      return sendReplayInternalError(reply, 'Failed to list categories');
    }
  });

  /**
   * GET /replay/scenarios/stats
   * Get scenario statistics
   */
  app.get('/replay/scenarios/stats', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const stats = await ScenarioService.getScenarioStatistics(orgId);

      return reply.send({
        status: 'ok',
        data: stats,
      });
    } catch (error) {
      console.error('GET /replay/scenarios/stats error:', error);
      return sendReplayInternalError(reply, 'Failed to get statistics');
    }
  });

  /**
   * GET /replay/scenario/:scenarioId
   * Get scenario details
   */
  app.get('/replay/scenario/:scenarioId', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const scenarioId = (request as any).params?.scenarioId;
      const scenario = await ScenarioService.getScenarioById(scenarioId, orgId);

      if (!scenario) {
        return reply.code(404).send({ status: 'error', message: 'Scenario not found' });
      }

      return reply.send({
        status: 'ok',
        data: scenario,
      });
    } catch (error) {
      console.error('GET /replay/scenario/:scenarioId error:', error);
      return sendReplayInternalError(reply, 'Failed to get scenario');
    }
  });

  /**
   * PUT /replay/scenario/:scenarioId
   * Update scenario configuration
   */
  app.put('/replay/scenario/:scenarioId', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    const actorUserId = currentActorUserId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    if (!actorUserId) {
      return reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authenticated user required' });
    }
    try {
      const scenarioId = (request as any).params?.scenarioId;
      const updates = normalizeReplayBody(request.body);
      if (!updates) {
        return reply.code(400).send({ status: 'error', code: 'VALIDATION_ERROR', message: 'request body must be a JSON object' });
      }

      const success = await ScenarioService.updateScenario(scenarioId, updates, orgId, actorUserId);

      if (!success) {
        return reply.code(404).send({ status: 'error', message: 'Scenario not found' });
      }

      return reply.send({
        status: 'ok',
        message: 'Scenario updated',
      });
    } catch (error) {
      console.error('PUT /replay/scenario/:scenarioId error:', error);
      return sendReplayInternalError(reply, 'Failed to update scenario');
    }
  });

  /**
   * DELETE /replay/scenario/:scenarioId
   * Delete a scenario
   */
  app.delete('/replay/scenario/:scenarioId', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    const actorUserId = currentActorUserId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    if (!actorUserId) {
      return reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authenticated user required' });
    }
    try {
      const scenarioId = (request as any).params?.scenarioId;
      const success = await ScenarioService.deleteScenario(scenarioId, orgId, actorUserId);

      if (!success) {
        return reply.code(404).send({ status: 'error', message: 'Scenario not found' });
      }

      return reply.send({
        status: 'ok',
        message: 'Scenario deleted',
      });
    } catch (error) {
      console.error('DELETE /replay/scenario/:scenarioId error:', error);
      return sendReplayInternalError(reply, 'Failed to delete scenario');
    }
  });

  // ============= SCENARIO VARIATIONS =============

  /**
   * POST /replay/scenario/:scenarioId/variation
   * Create a scenario variation
   */
  app.post('/replay/scenario/:scenarioId/variation', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const scenarioId = (request as any).params?.scenarioId;
      const body = normalizeReplayBody(request.body);
      if (!body) {
        return reply.code(400).send({ status: 'error', code: 'VALIDATION_ERROR', message: 'request body must be a JSON object' });
      }
      const { name, parameters, overrideMessage, overrideExpectedResponse, overrideExpectedTools } = body as any;
      if (!isUuid(scenarioId)) {
        return reply.code(400).send({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'scenarioId must be a UUID',
        });
      }
      if (typeof name !== 'string' || name.trim().length === 0) {
        return reply.code(400).send({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'name is required',
        });
      }
      if (
        parameters !== undefined &&
        (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters))
      ) {
        return reply.code(400).send({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'parameters must be a JSON object',
        });
      }
      const scenario = await ScenarioService.getScenarioById(scenarioId, orgId);
      if (!scenario) {
        return reply.code(404).send({
          status: 'error',
          code: 'NOT_FOUND',
          message: 'Scenario not found',
        });
      }

      const variation = await ScenarioService.createScenarioVariation(
        scenarioId,
        name,
        parameters,
        orgId,
        overrideMessage,
        overrideExpectedResponse,
        overrideExpectedTools
      );

      return reply.send({
        status: 'ok',
        data: variation,
      });
    } catch (error) {
      console.error('POST /replay/scenario/:scenarioId/variation error:', error);
      return sendReplayInternalError(reply, 'Failed to create variation');
    }
  });

  /**
   * GET /replay/scenario/:scenarioId/variations
   * List scenario variations
   */
  app.get('/replay/scenario/:scenarioId/variations', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const scenarioId = (request as any).params?.scenarioId;
      const variations = await ScenarioService.getScenarioVariations(scenarioId, orgId);

      return reply.send({
        status: 'ok',
        data: variations,
      });
    } catch (error) {
      console.error('GET /replay/scenario/:scenarioId/variations error:', error);
      return sendReplayInternalError(reply, 'Failed to list variations');
    }
  });

  // ============= REPLAY RUNS =============

  /**
   * POST /replay/run
   * Create and start a new replay run
   */
  app.post('/replay/run', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    const actorUserId = currentActorUserId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    if (!actorUserId) {
      return reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authenticated user required' });
    }
    try {
      const bodyRaw = normalizeReplayBody(request.body);
      if (!bodyRaw) {
        return reply.code(400).send({ status: 'error', code: 'VALIDATION_ERROR', message: 'request body must be a JSON object' });
      }
      const body = bodyRaw as {
        name?: string;
        description?: string;
        buildVersion?: string;
        scenarioIds?: unknown;
        filterCategory?: string;
      };
      const { name, description, buildVersion, scenarioIds, filterCategory } = body;

      if (!name || !buildVersion || !Array.isArray(scenarioIds) || scenarioIds.length === 0) {
        return reply.code(400).send({
          status: 'error',
          message: 'name, buildVersion, and scenarioIds[] required',
        });
      }
      const invalidScenarioId = scenarioIds.find(
        (id) => typeof id !== 'string' || !isUuid(id),
      );
      if (invalidScenarioId) {
        return reply.code(400).send({
          status: 'error',
          message: 'scenarioIds must be an array of UUID strings',
        });
      }
      const scenarioIdList = scenarioIds as string[];
      const scopedScenarios = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM scenarios
         WHERE id = ANY($1::uuid[]) AND organization_id::text = $2::text`,
        [scenarioIdList, orgId],
      );
      if (Number(scopedScenarios.rows[0]?.count || 0) !== scenarioIdList.length) {
        return reply.code(403).send({
          status: 'error',
          code: 'FORBIDDEN',
          message: 'scenarioIds must belong to active organization',
        });
      }

      const run = await ReplayService.createReplayRun(
        name,
        description ?? '',
        buildVersion,
        scenarioIdList,
        filterCategory,
        orgId,
        actorUserId,
      );

      // Start execution async
      setImmediate(() => {
        ReplayService.startReplayRun(run.id, orgId, actorUserId).catch((err) => {
          console.error('Replay run failed:', err);
        });
      });

      return reply.send({
        status: 'ok',
        data: run,
      });
    } catch (error) {
      console.error('POST /replay/run error:', error);
      return sendReplayInternalError(reply, 'Failed to create replay run');
    }
  });

  /**
   * GET /replay/runs
   * List all replay runs
   */
  app.get('/replay/runs', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const query = (request as any).query || {};
      const limit = parseReplayRunsLimit(query.limit);
      if (limit === null) {
        return reply.code(400).send({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'limit must be a positive integer when provided',
        });
      }

      const runs = await ReplayService.listReplayRuns(limit, orgId);

      return reply.send({
        status: 'ok',
        data: runs,
      });
    } catch (error) {
      console.error('GET /replay/runs error:', error);
      return sendReplayInternalError(reply, 'Failed to list replay runs');
    }
  });

  /**
   * GET /replay/run/:runId
   * Get replay run details
   */
  app.get('/replay/run/:runId', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const runId = (request as any).params?.runId;
      const run = await ReplayService.getReplayRun(runId, orgId);

      if (!run) {
        return reply.code(404).send({ status: 'error', message: 'Replay run not found' });
      }

      return reply.send({
        status: 'ok',
        data: run,
      });
    } catch (error) {
      console.error('GET /replay/run/:runId error:', error);
      return sendReplayInternalError(reply, 'Failed to get replay run');
    }
  });

  /**
   * GET /replay/run/:runId/results
   * Get replay run results
   */
  app.get('/replay/run/:runId/results', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const runId = (request as any).params?.runId;
      const query = (request as any).query || {};
      const passedOnly = query.passedOnly === 'true';

      const results = await ReplayService.getReplayResults(runId, passedOnly, orgId);

      return reply.send({
        status: 'ok',
        data: results,
      });
    } catch (error) {
      console.error('GET /replay/run/:runId/results error:', error);
      return sendReplayInternalError(reply, 'Failed to get replay results');
    }
  });

  /**
   * GET /replay/run/:runId/summary
   * Get replay run summary
   */
  app.get('/replay/run/:runId/summary', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    try {
      const runId = (request as any).params?.runId;
      const summary = await ReplayService.getReplaySummary(runId, orgId);

      return reply.send({
        status: 'ok',
        data: summary,
      });
    } catch (error) {
      console.error('GET /replay/run/:runId/summary error:', error);
      return sendReplayInternalError(reply, 'Failed to get replay summary');
    }
  });

  // ============= OUTPUT COMPARISON =============

  /**
   * POST /replay/compare
   * Compare two replay runs (baseline vs new build)
   */
  app.post('/replay/compare', async (request: any, reply: any) => {
    if (!requireGlobalAdmin(request, reply)) return;
    const orgId = currentOrgId(request);
    const actorUserId = currentActorUserId(request);
    if (!orgId) {
      return reply.code(403).send({ status: 'error', code: 'ORG_REQUIRED', message: 'Active account required' });
    }
    if (!actorUserId) {
      return reply.code(401).send({ status: 'error', code: 'UNAUTHENTICATED', message: 'Authenticated user required' });
    }
    try {
      const body = normalizeReplayBody(request.body);
      if (!body) {
        return reply.code(400).send({ status: 'error', code: 'VALIDATION_ERROR', message: 'request body must be a JSON object' });
      }
      const { baselineReplayRunId, newReplayRunId, comparisonType } = body as any;

      if (!baselineReplayRunId || !newReplayRunId) {
        return reply.code(400).send({
          status: 'error',
          message: 'baselineReplayRunId and newReplayRunId required',
        });
      }

      const comparison = await ReplayService.compareReplayRuns(
        baselineReplayRunId,
        newReplayRunId,
        comparisonType || 'full',
        orgId,
        actorUserId,
      );

      return reply.send({
        status: 'ok',
        data: comparison,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ReplayRunNotFoundError') {
        return reply.code(404).send({
          status: 'error',
          message: error.message,
        });
      }
      if (error instanceof Error && error.name === 'ReplayRunNotReadyError') {
        return reply.code(409).send({
          status: 'error',
          message: error.message,
        });
      }
      console.error('POST /replay/compare error:', error);
      return sendReplayInternalError(reply, 'Failed to compare replay runs');
    }
  });

  console.log('✅ Replay routes registered');
}

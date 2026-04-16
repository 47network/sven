import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-council');

export function registerCouncilRoutes(app: FastifyInstance, pool: pg.Pool) {
  // A.3.1 — POST /council/deliberate — trigger ad-hoc council deliberation
  app.post('/council/deliberate', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const query = String(body?.query || '').trim();
    if (!query || query.length < 3) {
      return reply.status(400).send({ error: 'query is required (min 3 characters)' });
    }

    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;

    // Read council config from agent_configs or use defaults
    const configRes = await pool.query(
      `SELECT settings FROM agent_configs
       WHERE settings->>'council_mode' = 'true'
       AND agent_id IN (SELECT id FROM agents WHERE org_id = $1)
       LIMIT 1`,
      [orgId],
    );

    const settings = configRes.rows[0]?.settings || {};
    const models = Array.isArray(settings.council_models)
      ? settings.council_models
      : ['qwen2.5-coder:32b', 'qwen2.5:7b', 'deepseek-r1:7b'];
    const chairman = String(settings.council_chairman || models[0] || 'qwen2.5-coder:32b');
    const strategy = String(settings.council_strategy || 'weighted');
    const rounds = Number(settings.council_rounds || 1);

    // Override from request body
    const requestModels = Array.isArray(body?.models) ? body.models as string[] : models;
    const requestChairman = body?.chairman ? String(body.chairman) : chairman;
    const requestStrategy = body?.strategy ? String(body.strategy) : strategy;
    const requestRounds = body?.rounds ? Number(body.rounds) : rounds;

    logger.info('Council deliberation requested via API', {
      userId,
      orgId,
      queryPreview: query.slice(0, 80),
      models: requestModels.length,
    });

    // Store the request for async processing — the actual deliberation happens in agent-runtime
    const sessionId = `council-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Insert a council session record for tracking
    await pool.query(
      `INSERT INTO council_sessions (id, org_id, user_id, query, config, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT DO NOTHING`,
      [
        sessionId,
        orgId,
        userId,
        query.slice(0, 10000),
        JSON.stringify({
          models: requestModels,
          chairman: requestChairman,
          strategy: requestStrategy,
          rounds: requestRounds,
          anonymize: body?.anonymize !== false,
        }),
      ],
    );

    return reply.status(202).send({
      sessionId,
      status: 'pending',
      config: {
        models: requestModels,
        chairman: requestChairman,
        strategy: requestStrategy,
        rounds: requestRounds,
      },
      message: 'Deliberation queued. Use GET /council/sessions/:id to check status.',
    });
  });

  // A.3.2 — GET /council/sessions — list council sessions
  app.get('/council/sessions', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const params = request.query as Record<string, string>;
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const offset = Math.max(0, Number(params.offset || 0));

    const result = await pool.query(
      `SELECT id, user_id, query, config, status, synthesis,
              total_tokens_prompt, total_tokens_completion, total_cost,
              elapsed_ms, created_at, completed_at
       FROM council_sessions
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset],
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM council_sessions WHERE org_id = $1`,
      [orgId],
    );

    return reply.send({
      sessions: result.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        query: String(r.query || '').slice(0, 200),
        config: r.config,
        status: r.status,
        synthesisPreview: r.synthesis ? String(r.synthesis).slice(0, 300) : null,
        totalTokens: {
          prompt: Number(r.total_tokens_prompt || 0),
          completion: Number(r.total_tokens_completion || 0),
        },
        totalCost: Number(r.total_cost || 0),
        elapsedMs: Number(r.elapsed_ms || 0),
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
      total: countRes.rows[0]?.total || 0,
      limit,
      offset,
    });
  });

  // A.3.3 — GET /council/sessions/:id — single session detail
  app.get('/council/sessions/:id', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const sessionId = (request.params as any).id as string;

    const result = await pool.query(
      `SELECT id, user_id, query, config, status, synthesis, opinions, peer_reviews,
              scores, total_tokens_prompt, total_tokens_completion, total_cost,
              elapsed_ms, created_at, completed_at
       FROM council_sessions
       WHERE id = $1 AND org_id = $2`,
      [sessionId, orgId],
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Council session not found' });
    }

    const r = result.rows[0];
    return reply.send({
      id: r.id,
      userId: r.user_id,
      query: r.query,
      config: r.config,
      status: r.status,
      synthesis: r.synthesis,
      opinions: r.opinions || [],
      peerReviews: r.peer_reviews || [],
      scores: r.scores || {},
      totalTokens: {
        prompt: Number(r.total_tokens_prompt || 0),
        completion: Number(r.total_tokens_completion || 0),
      },
      totalCost: Number(r.total_cost || 0),
      elapsedMs: Number(r.elapsed_ms || 0),
      createdAt: r.created_at,
      completedAt: r.completed_at,
    });
  });

  // A.3.4 — PUT /council/config — update org-level council configuration
  app.put('/council/config', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown> | undefined;
    if (!body) {
      return reply.status(400).send({ error: 'Request body required' });
    }

    // Validate models array
    const models = Array.isArray(body.models) ? (body.models as string[]).filter(Boolean) : undefined;
    if (models && models.length < 2) {
      return reply.status(400).send({ error: 'Council requires at least 2 models' });
    }

    const chairman = body.chairman ? String(body.chairman).trim() : undefined;
    const strategy = body.strategy ? String(body.strategy).trim() : undefined;
    const rounds = typeof body.rounds === 'number' ? Math.min(5, Math.max(1, body.rounds)) : undefined;
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;

    const validStrategies = ['best_of_n', 'majority_vote', 'debate', 'weighted'];
    if (strategy && !validStrategies.includes(strategy)) {
      return reply.status(400).send({ error: `Invalid strategy. Use: ${validStrategies.join(', ')}` });
    }

    // Store as org-level setting
    const configUpdate: Record<string, unknown> = {};
    if (enabled !== undefined) configUpdate.council_mode = enabled;
    if (models) configUpdate.council_models = models;
    if (chairman) configUpdate.council_chairman = chairman;
    if (strategy) configUpdate.council_strategy = strategy;
    if (rounds) configUpdate.council_rounds = rounds;

    for (const [key, value] of Object.entries(configUpdate)) {
      await pool.query(
        `INSERT INTO settings_global (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [`council.${key}`, JSON.stringify(value)],
      );
    }

    logger.info('Council configuration updated', { orgId, config: configUpdate });

    return reply.send({
      updated: true,
      config: configUpdate,
    });
  });

  // GET /council/config — read current council configuration
  app.get('/council/config', async (request, reply) => {
    const configRes = await pool.query(
      `SELECT key, value FROM settings_global WHERE key LIKE 'council.%'`,
    );

    const config: Record<string, unknown> = {};
    for (const row of configRes.rows) {
      const shortKey = String(row.key).replace(/^council\./, '');
      try {
        config[shortKey] = JSON.parse(String(row.value));
      } catch {
        config[shortKey] = row.value;
      }
    }

    return reply.send({ config });
  });
}

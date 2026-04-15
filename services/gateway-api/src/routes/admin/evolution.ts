import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-evolution');

export function registerEvolutionRoutes(app: FastifyInstance, pool: pg.Pool) {
  // B.6.1 — GET /evolution/runs — list evolution runs
  app.get('/evolution/runs', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const query = request.query as Record<string, string>;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const status = query.status;

    let sql = `SELECT id, org_id, user_id, experiment->>'domain' AS domain,
                      experiment->>'name' AS name, status, current_gen,
                      best_score, total_evals, started_at, updated_at, completed_at
               FROM evolution_runs WHERE org_id = $1`;
    const params: unknown[] = [orgId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    try {
      const result = await pool.query(sql, params);
      return reply.send({ runs: result.rows, total: result.rows.length });
    } catch (err) {
      logger.error('Failed to list evolution runs', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to list evolution runs' });
    }
  });

  // B.6.2 — GET /evolution/runs/:id — get evolution run detail
  app.get('/evolution/runs/:id', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };

    try {
      const runResult = await pool.query(
        `SELECT * FROM evolution_runs WHERE id = $1 AND org_id = $2`,
        [id, orgId],
      );
      if (runResult.rows.length === 0) {
        return reply.status(404).send({ error: `Run ${id} not found` });
      }

      const run = runResult.rows[0];

      // Get nodes
      const nodesResult = await pool.query(
        `SELECT id, parent_id, generation, score, metrics, analysis, visits, created_at
         FROM evolution_nodes WHERE run_id = $1 ORDER BY generation ASC, score DESC`,
        [id],
      );

      // Get cognition entries
      const cogResult = await pool.query(
        `SELECT id, title, source, relevance, created_at
         FROM evolution_cognition WHERE run_id = $1 ORDER BY relevance DESC`,
        [id],
      );

      return reply.send({
        run,
        nodes: nodesResult.rows,
        cognition: cogResult.rows,
        node_count: nodesResult.rows.length,
        cognition_count: cogResult.rows.length,
      });
    } catch (err) {
      logger.error('Failed to get evolution run', { err: String(err), runId: id });
      return reply.status(500).send({ error: 'Failed to get evolution run' });
    }
  });

  // B.6.3 — POST /evolution/runs — create a new evolution run
  app.post('/evolution/runs', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown> | undefined;

    const domain = body?.domain as string;
    const experiment = body?.experiment as Record<string, unknown> | undefined;
    const config = body?.config as Record<string, unknown> | undefined;

    if (!domain && !experiment) {
      return reply.status(400).send({ error: 'domain or experiment is required' });
    }

    const runId = `evo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      await pool.query(
        `INSERT INTO evolution_runs (id, org_id, user_id, experiment, config, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [
          runId,
          orgId,
          userId,
          JSON.stringify(experiment || { domain }),
          JSON.stringify(config || {}),
        ],
      );

      logger.info('Evolution run created via API', { runId, orgId, domain });
      return reply.status(201).send({ run_id: runId, status: 'pending' });
    } catch (err) {
      logger.error('Failed to create evolution run', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to create evolution run' });
    }
  });

  // B.6.4 — POST /evolution/runs/:id/stop — stop a running evolution
  app.post('/evolution/runs/:id/stop', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };

    try {
      const result = await pool.query(
        `UPDATE evolution_runs SET status = 'stopped', updated_at = NOW()
         WHERE id = $1 AND org_id = $2 AND status IN ('pending', 'running')
         RETURNING id`,
        [id, orgId],
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: `Run ${id} not found or not stoppable` });
      }

      logger.info('Evolution run stopped via API', { runId: id, orgId });
      return reply.send({ run_id: id, status: 'stopped' });
    } catch (err) {
      logger.error('Failed to stop evolution run', { err: String(err), runId: id });
      return reply.status(500).send({ error: 'Failed to stop evolution run' });
    }
  });

  // B.6.5 — GET /evolution/runs/:id/best — get best node from a run
  app.get('/evolution/runs/:id/best', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };

    try {
      const runResult = await pool.query(
        `SELECT best_node_id FROM evolution_runs WHERE id = $1 AND org_id = $2`,
        [id, orgId],
      );

      if (runResult.rows.length === 0) {
        return reply.status(404).send({ error: `Run ${id} not found` });
      }

      const bestNodeId = runResult.rows[0].best_node_id;
      if (!bestNodeId) {
        return reply.status(404).send({ error: 'No best node yet — run may not have started' });
      }

      const nodeResult = await pool.query(
        `SELECT * FROM evolution_nodes WHERE id = $1`,
        [bestNodeId],
      );

      return reply.send({ best: nodeResult.rows[0] });
    } catch (err) {
      logger.error('Failed to get best node', { err: String(err), runId: id });
      return reply.status(500).send({ error: 'Failed to get best node' });
    }
  });

  // B.6.6 — POST /evolution/runs/:id/knowledge — inject knowledge
  app.post('/evolution/runs/:id/knowledge', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown> | undefined;
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();

    if (!title || !content) {
      return reply.status(400).send({ error: 'title and content are required' });
    }

    try {
      // Verify run exists and belongs to org
      const runResult = await pool.query(
        `SELECT id FROM evolution_runs WHERE id = $1 AND org_id = $2`,
        [id, orgId],
      );
      if (runResult.rows.length === 0) {
        return reply.status(404).send({ error: `Run ${id} not found` });
      }

      const cogId = `cog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO evolution_cognition (id, run_id, title, content, source, relevance)
         VALUES ($1, $2, $3, $4, 'user', 0.9)`,
        [cogId, id, title, content],
      );

      logger.info('Knowledge injected via API', { runId: id, title });
      return reply.send({ id: cogId, message: 'Knowledge injected' });
    } catch (err) {
      logger.error('Failed to inject knowledge', { err: String(err), runId: id });
      return reply.status(500).send({ error: 'Failed to inject knowledge' });
    }
  });

  // B.6.7 — GET /evolution/templates — list experiment templates
  app.get('/evolution/templates', async (_request, reply) => {
    const templates = [
      { domain: 'rag_retrieval', name: 'RAG Retrieval Evolution', description: 'Evolve scoring and fusion weights for RAG retrieval' },
      { domain: 'model_routing', name: 'Model Routing Evolution', description: 'Evolve routing heuristics for model selection' },
      { domain: 'prompt_engineering', name: 'Prompt Engineering Evolution', description: 'Evolve system prompts for task completion' },
      { domain: 'scheduling', name: 'Scheduling Evolution', description: 'Evolve workflow scheduling policies' },
    ];
    return reply.send({ templates });
  });

  // B.6.8 — GET /evolution/stats — aggregate evolution stats
  app.get('/evolution/stats', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    try {
      const statsResult = await pool.query(
        `SELECT
           COUNT(*)::int AS total_runs,
           COUNT(*) FILTER (WHERE status IN ('running','pending'))::int AS active_runs,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_runs,
           COALESCE(SUM(total_evals), 0)::int AS total_evaluations,
           COALESCE(AVG(best_score) FILTER (WHERE status = 'completed'), 0) AS avg_best_score
         FROM evolution_runs WHERE org_id = $1`,
        [orgId],
      );

      return reply.send({ stats: statsResult.rows[0] });
    } catch (err) {
      logger.error('Failed to get evolution stats', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to get evolution stats' });
    }
  });
}

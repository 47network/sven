import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('admin-video');

export function registerVideoRoutes(app: FastifyInstance, pool: pg.Pool) {
  // GET /video/jobs — list render jobs
  app.get('/video/jobs', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const query = request.query as Record<string, string>;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const status = query.status;

    let sql = `SELECT id, org_id, user_id, title, template, status, progress,
                      output_format, duration_secs, render_time_ms, width, height,
                      created_at, updated_at, started_at, completed_at
               FROM video_render_jobs WHERE org_id = $1`;
    const params: unknown[] = [orgId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    try {
      const result = await pool.query(sql, params);
      return reply.send({ jobs: result.rows, total: result.rows.length });
    } catch (err) {
      logger.error('Failed to list video jobs', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to list video jobs' });
    }
  });

  // GET /video/jobs/:id — get render job detail
  app.get('/video/jobs/:id', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };

    try {
      const result = await pool.query(
        `SELECT * FROM video_render_jobs WHERE id = $1 AND org_id = $2`,
        [id, orgId],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Render job not found' });
      }
      return reply.send(result.rows[0]);
    } catch (err) {
      logger.error('Failed to get video job', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to get video job' });
    }
  });

  // POST /video/jobs — create render job
  app.post('/video/jobs', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const userId = (request as any).userId as string;
    const body = request.body as Record<string, unknown>;

    const title = String(body.title ?? 'Untitled Video');
    const description = body.description as string | undefined;
    const template = body.template as string | undefined;
    const spec = body.spec as Record<string, unknown> | undefined;

    if (!spec) {
      return reply.status(400).send({ error: 'spec is required' });
    }

    const width = Number(spec.width) || 1920;
    const height = Number(spec.height) || 1080;
    const fps = Number(spec.fps) || 30;
    const durationSecs = Array.isArray(spec.scenes)
      ? (spec.scenes as Array<{ duration?: number }>).reduce((s, sc) => s + (Number(sc.duration) || 0), 0)
      : 0;
    const outputFormat = spec.format === 'webm' ? 'webm' : 'mp4';

    try {
      const result = await pool.query(
        `INSERT INTO video_render_jobs
           (org_id, user_id, title, description, template, spec, status,
            width, height, fps, duration_secs, output_format)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11)
         RETURNING id, status, created_at`,
        [orgId, userId, title, description, template, JSON.stringify(spec),
         width, height, fps, durationSecs, outputFormat],
      );
      return reply.status(201).send(result.rows[0]);
    } catch (err) {
      logger.error('Failed to create video job', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to create video job' });
    }
  });

  // POST /video/jobs/:id/cancel — cancel a render job
  app.post('/video/jobs/:id/cancel', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const { id } = request.params as { id: string };

    try {
      const result = await pool.query(
        `UPDATE video_render_jobs SET status = 'cancelled'
         WHERE id = $1 AND org_id = $2 AND status IN ('pending', 'rendering')
         RETURNING id, status`,
        [id, orgId],
      );
      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Job not found or not cancellable' });
      }
      return reply.send(result.rows[0]);
    } catch (err) {
      logger.error('Failed to cancel video job', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to cancel video job' });
    }
  });

  // GET /video/templates — list built-in + custom templates
  app.get('/video/templates', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    const builtIn = [
      { domain: 'social_media', name: 'Social Media Post', aspectRatio: '9:16', type: 'built-in' },
      { domain: 'data_dashboard', name: 'Data Dashboard Animation', aspectRatio: '16:9', type: 'built-in' },
      { domain: 'product_showcase', name: 'Product Showcase', aspectRatio: '16:9', type: 'built-in' },
      { domain: 'tutorial', name: 'Tutorial / Walkthrough', aspectRatio: '16:9', type: 'built-in' },
      { domain: 'brand', name: 'XLVII Brand Template', aspectRatio: '16:9', type: 'built-in' },
    ];

    try {
      const result = await pool.query(
        `SELECT id, name, description, domain, aspect_ratio, is_active, created_at
         FROM video_templates_custom WHERE org_id = $1 AND is_active = true
         ORDER BY name ASC`,
        [orgId],
      );
      const custom = result.rows.map(r => ({ ...r, type: 'custom' }));
      return reply.send({ templates: [...builtIn, ...custom], total: builtIn.length + custom.length });
    } catch (err) {
      logger.error('Failed to list video templates', { err: String(err) });
      return reply.send({ templates: builtIn, total: builtIn.length });
    }
  });

  // POST /video/templates — create custom template
  app.post('/video/templates', async (request, reply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown>;

    const name = String(body.name ?? '');
    const description = body.description as string | undefined;
    const aspectRatio = String(body.aspect_ratio ?? '16:9');
    const spec = body.spec as Record<string, unknown> | undefined;

    if (!name) return reply.status(400).send({ error: 'name is required' });
    if (!spec) return reply.status(400).send({ error: 'spec is required' });

    try {
      const result = await pool.query(
        `INSERT INTO video_templates_custom (org_id, name, description, aspect_ratio, spec)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, created_at`,
        [orgId, name, description, aspectRatio, JSON.stringify(spec)],
      );
      return reply.status(201).send(result.rows[0]);
    } catch (err) {
      logger.error('Failed to create video template', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to create video template' });
    }
  });

  // GET /video/stats — aggregate render stats
  app.get('/video/stats', async (request, reply) => {
    const orgId = (request as any).orgId as string;

    try {
      const result = await pool.query(
        `SELECT
           COUNT(*) AS total_jobs,
           COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(*) FILTER (WHERE status = 'rendering') AS rendering,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COALESCE(AVG(render_time_ms) FILTER (WHERE status = 'completed'), 0) AS avg_render_time_ms,
           COALESCE(SUM(output_size) FILTER (WHERE status = 'completed'), 0) AS total_output_bytes,
           COALESCE(SUM(duration_secs) FILTER (WHERE status = 'completed'), 0) AS total_video_secs
         FROM video_render_jobs WHERE org_id = $1`,
        [orgId],
      );
      return reply.send(result.rows[0]);
    } catch (err) {
      logger.error('Failed to get video stats', { err: String(err) });
      return reply.status(500).send({ error: 'Failed to get video stats' });
    }
  });
}

// ---------------------------------------------------------------------------
// Admin Routes — Training (Model Fine-Tuning)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function trainingRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /training/jobs — list training jobs
  fastify.get('/training/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    const query = request.query as Record<string, string>;
    const status = query.status;
    return reply.send({ ok: true, org_id: orgId, status_filter: status || null, jobs: [] });
  });

  // GET /training/jobs/:id — get job detail
  fastify.get('/training/jobs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid job ID.' });
    }
    return reply.send({ ok: true, job_id: id });
  });

  // POST /training/jobs — create training job
  fastify.post('/training/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown> | undefined;
    const recipe = body?.recipe as string | undefined;
    const config = body?.config as Record<string, unknown> | undefined;
    const dataSources = body?.data_sources as unknown[] | undefined;

    if (!dataSources?.length && !body?.samples) {
      return reply.status(400).send({ error: 'Either data_sources or samples is required.' });
    }

    return reply.status(201).send({
      ok: true,
      org_id: orgId,
      recipe: recipe || null,
      config: config || {},
      status: 'pending',
    });
  });

  // POST /training/jobs/:id/cancel — cancel training job
  fastify.post('/training/jobs/:id/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid job ID.' });
    }
    return reply.send({ ok: true, job_id: id, status: 'cancelled' });
  });

  // GET /training/recipes — list available recipes
  fastify.get('/training/recipes', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      recipes: [
        { domain: 'writing_style', name: 'Writing Style Adaptation' },
        { domain: 'codebase_conventions', name: 'Codebase Convention Learning' },
        { domain: 'domain_vocabulary', name: 'Domain Vocabulary Specialist' },
      ],
    });
  });

  // GET /training/exports — list model exports
  fastify.get('/training/exports', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    return reply.send({ ok: true, org_id: orgId, exports: [] });
  });

  // POST /training/exports — register model export
  fastify.post('/training/exports', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const jobId = body?.job_id as string | undefined;
    const modelName = body?.model_name as string | undefined;

    if (!jobId || !modelName) {
      return reply.status(400).send({ error: 'job_id and model_name are required.' });
    }

    return reply.status(201).send({ ok: true, job_id: jobId, model_name: modelName });
  });

  // GET /training/stats — training statistics
  fastify.get('/training/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      total_jobs: 0,
      active_jobs: 0,
      completed_jobs: 0,
      failed_jobs: 0,
    });
  });
}

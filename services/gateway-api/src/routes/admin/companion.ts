// ---------------------------------------------------------------------------
// Admin Routes — Companion (Desktop Character)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function companionRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /companion/sessions — list sessions for org
  fastify.get('/companion/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    // In production, this queries companion_sessions table
    return reply.send({ ok: true, org_id: orgId, sessions: [] });
  });

  // GET /companion/sessions/:id — get session detail
  fastify.get('/companion/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid session ID.' });
    }
    return reply.send({ ok: true, session_id: id });
  });

  // POST /companion/sessions — create companion session
  fastify.post('/companion/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown> | undefined;
    const userId = body?.user_id as string | undefined;
    if (!userId) {
      return reply.status(400).send({ error: 'user_id is required.' });
    }
    const form = body?.form as string | undefined;
    const preferences = body?.preferences as Record<string, unknown> | undefined;

    return reply.status(201).send({
      ok: true,
      org_id: orgId,
      user_id: userId,
      form: form || 'orb',
      preferences: preferences || {},
    });
  });

  // DELETE /companion/sessions/:id — destroy session
  fastify.delete('/companion/sessions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid session ID.' });
    }
    return reply.send({ ok: true, session_id: id, destroyed: true });
  });

  // POST /companion/sessions/:id/event — process agent event
  fastify.post('/companion/sessions/:id/event', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid session ID.' });
    }
    const body = request.body as Record<string, unknown> | undefined;
    const eventType = body?.type as string | undefined;
    if (!eventType) {
      return reply.status(400).send({ error: 'Event type is required.' });
    }
    return reply.send({ ok: true, session_id: id, event_type: eventType });
  });

  // PUT /companion/sessions/:id/preferences — update preferences
  fastify.put('/companion/sessions/:id/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'Invalid session ID.' });
    }
    const body = request.body as Record<string, unknown> | undefined;
    return reply.send({ ok: true, session_id: id, preferences: body || {} });
  });

  // GET /companion/sound-packs — list sound packs
  fastify.get('/companion/sound-packs', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    return reply.send({ ok: true, org_id: orgId, sound_packs: [{ name: 'default', description: 'Built-in sound effects' }] });
  });

  // POST /companion/sound-packs — create custom sound pack
  fastify.post('/companion/sound-packs', async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = (request as any).orgId as string;
    const body = request.body as Record<string, unknown> | undefined;
    const name = body?.name as string | undefined;
    if (!name) {
      return reply.status(400).send({ error: 'Sound pack name is required.' });
    }
    return reply.status(201).send({ ok: true, org_id: orgId, name, sounds: body?.sounds || {} });
  });

  // GET /companion/stats — companion usage statistics
  fastify.get('/companion/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      active_sessions: 0,
      total_transitions: 0,
      celebration_count: 0,
      error_count: 0,
    });
  });
}

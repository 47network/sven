import type { FastifyInstance } from 'fastify';
import type { EidolonRepository } from '../repo.js';

const MAX_ORG_ID_LEN = 80;

function validateOrgId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_ORG_ID_LEN) return null;
  if (!/^[a-zA-Z0-9_\-:.]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function registerSnapshotRoute(
  app: FastifyInstance,
  repo: EidolonRepository,
): Promise<void> {
  app.get<{ Querystring: { orgId?: string } }>('/v1/eidolon/snapshot', async (req, reply) => {
    const orgId = validateOrgId(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
    if (!orgId) {
      return reply.code(400).send({ error: 'orgId required (query param or EIDOLON_DEFAULT_ORG_ID)' });
    }
    const snapshot = await repo.getSnapshot(orgId);
    reply.header('Cache-Control', 'no-store');
    return snapshot;
  });
}

import type { FastifyInstance } from 'fastify';
import type { EidolonRepository } from '../repo.js';
import type { EidolonWriteRepository } from '../repo-write.js';

const MAX_ORG_ID_LEN = 80;
const RECENT_TICKS = 5;
const RECENT_INTERACTIONS = 10;

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
  writeRepo: EidolonWriteRepository,
): Promise<void> {
  app.get<{ Querystring: { orgId?: string } }>('/v1/eidolon/snapshot', async (req, reply) => {
    const orgId = validateOrgId(req.query?.orgId ?? process.env.EIDOLON_DEFAULT_ORG_ID);
    if (!orgId) {
      return reply.code(400).send({ error: 'orgId required (query param or EIDOLON_DEFAULT_ORG_ID)' });
    }

    // Fan-out: read projection + world overview in parallel. World overview
    // failures must NEVER 500 the snapshot — agents and treasury are critical,
    // tick/interaction telemetry is best-effort presentation data.
    const [snapshot, worldOverview] = await Promise.all([
      repo.getSnapshot(orgId),
      buildWorldOverview(orgId, writeRepo).catch((err) => {
        req.log?.warn?.({ err: (err as Error).message }, 'world_overview_failed');
        return null;
      }),
    ]);

    reply.header('Cache-Control', 'no-store');
    return { ...snapshot, world: worldOverview };
  });
}

async function buildWorldOverview(orgId: string, writeRepo: EidolonWriteRepository) {
  const [ticks, interactions, agentIds, businesses] = await Promise.all([
    writeRepo.listRecentTicks(orgId, RECENT_TICKS),
    writeRepo.listRecentInteractions(orgId, RECENT_INTERACTIONS),
    writeRepo.listOrgAgentIds(orgId),
    writeRepo.listOrgBusinesses(orgId, 200),
  ]);

  const states = agentIds.length > 0 ? await writeRepo.fetchStates(agentIds) : new Map();
  const stateCounts: Record<string, number> = {};
  // Per-agent runtime snapshot — kept intentionally narrow: only the fields the
  // UI uses to colour/animate citizens. Bounded by org agent count (typically
  // <100) so the payload stays small.
  const agentStates: Record<string, { state: string; energy: number; mood: string; targetLocation: string | null }> = {};
  for (const s of states.values()) {
    stateCounts[s.state] = (stateCounts[s.state] ?? 0) + 1;
    agentStates[s.agentId] = {
      state: s.state,
      energy: s.energy,
      mood: s.mood,
      targetLocation: s.targetLocation,
    };
  }

  const businessStatusCounts: Record<string, number> = {};
  for (const b of businesses) {
    businessStatusCounts[b.status] = (businessStatusCounts[b.status] ?? 0) + 1;
  }

  return {
    latestTick: ticks[0] ?? null,
    recentTicks: ticks,
    recentInteractions: interactions,
    agentRuntime: {
      total: agentIds.length,
      withState: states.size,
      stateCounts,
    },
    agentStates,
    businesses: {
      total: businesses.length,
      statusCounts: businessStatusCounts,
    },
  };
}

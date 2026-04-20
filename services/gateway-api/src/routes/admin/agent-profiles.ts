// ---------------------------------------------------------------------------
// Admin routes for agent profiles (Batch 17).
//
// GET    /v1/admin/agent-profiles/archetypes     → list defined archetypes
// GET    /v1/admin/agent-profiles                → list profiles (filterable)
// GET    /v1/admin/agent-profiles/:agentId       → single profile
// POST   /v1/admin/agent-profiles                → create profile
// PATCH  /v1/admin/agent-profiles/:agentId       → update profile fields
// GET    /v1/admin/agent-profiles/:agentId/stats  → aggregate stats
// ---------------------------------------------------------------------------

import { FastifyInstance } from 'fastify';
import pg from 'pg';
import type { NatsConnection } from 'nats';

const VALID_ARCHETYPES = ['seller', 'translator', 'writer', 'scout', 'analyst', 'operator', 'accountant', 'marketer', 'researcher', 'legal', 'designer', 'support', 'strategist', 'recruiter', 'custom'] as const;
const VALID_STATUSES = ['active', 'suspended', 'retired'] as const;

type ProfileRow = {
  id: string; agent_id: string; org_id: string;
  display_name: string; bio: string | null; avatar_url: string | null;
  archetype: string; specializations: string[];
  reputation: { rating: number; reviewCount: number; totalSales: number };
  personality_mode: string; status: string;
  payout_account_id: string | null; commission_pct: string;
  token_balance: string;
  metadata: Record<string, unknown> | null;
  created_at: Date; updated_at: Date;
};

function toProfile(r: ProfileRow) {
  return {
    id: r.id,
    agentId: r.agent_id,
    orgId: r.org_id,
    displayName: r.display_name,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    archetype: r.archetype,
    specializations: r.specializations ?? [],
    reputation: r.reputation ?? { rating: 0, reviewCount: 0, totalSales: 0 },
    personalityMode: r.personality_mode,
    status: r.status,
    payoutAccountId: r.payout_account_id,
    commissionPct: Number(r.commission_pct),
    tokenBalance: Number(r.token_balance ?? 0),
    metadata: r.metadata ?? {},
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function newId(): string {
  return `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publishProfileEvent(nc: NatsConnection | null, agentId: string, archetype: string, action: string): void {
  if (!nc) return;
  try {
    nc.publish('sven.agent.profile_updated', Buffer.from(JSON.stringify({
      agentId, archetype, action, ts: Date.now(),
    })));
  } catch { /* NATS publish failure is non-fatal */ }
}

export async function registerAgentProfileRoutes(app: FastifyInstance, pool: pg.Pool, nc?: NatsConnection | null): Promise<void> {

  // --- List all defined archetypes with their defaults ---
  app.get('/agent-profiles/archetypes', async () => {
    const archetypes = VALID_ARCHETYPES.map((a) => ({
      key: a,
      label: a.charAt(0).toUpperCase() + a.slice(1),
      validStatuses: [...VALID_STATUSES],
    }));
    return { success: true, data: { archetypes } };
  });

  // --- List agent profiles (filterable by archetype, status) ---
  app.get('/agent-profiles', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const archetype = String(req.query?.archetype || '').trim();
    const status = String(req.query?.status || '').trim();
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query?.offset) || 0, 0);

    const params: unknown[] = [orgId];
    let where = 'WHERE org_id = $1';
    if (archetype && (VALID_ARCHETYPES as readonly string[]).includes(archetype)) {
      params.push(archetype);
      where += ` AND archetype = $${params.length}`;
    }
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }

    const res = await pool.query<ProfileRow>(
      `SELECT * FROM agent_profiles ${where}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return { success: true, data: { profiles: res.rows.map(toProfile) } };
  });

  // --- Get single agent profile ---
  app.get<{ Params: { agentId: string } }>('/agent-profiles/:agentId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const res = await pool.query<ProfileRow>(
      `SELECT * FROM agent_profiles WHERE agent_id = $1 AND org_id = $2 LIMIT 1`,
      [req.params.agentId, orgId],
    );
    if (!res.rows[0]) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    }
    return { success: true, data: { profile: toProfile(res.rows[0]) } };
  });

  // --- Create agent profile ---
  app.post('/agent-profiles', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const body = req.body as Record<string, unknown> | undefined;
    if (!body) return reply.status(400).send({ success: false, error: { code: 'BAD_BODY' } });

    const agentId = String(body.agentId || '').trim();
    const displayName = String(body.displayName || '').trim();
    const archetype = String(body.archetype || 'custom').trim();

    if (!agentId || !displayName) {
      return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'agentId and displayName required' } });
    }
    if (!(VALID_ARCHETYPES as readonly string[]).includes(archetype)) {
      return reply.status(400).send({ success: false, error: { code: 'INVALID_ARCHETYPE', message: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` } });
    }

    const id = newId();
    const bio = body.bio != null ? String(body.bio).slice(0, 2000) : null;
    const avatarUrl = body.avatarUrl != null ? String(body.avatarUrl).slice(0, 500) : null;
    const specializations = Array.isArray(body.specializations) ? body.specializations.map(String).slice(0, 20) : [];
    const personalityMode = String(body.personalityMode || 'professional').slice(0, 40);
    const payoutAccountId = body.payoutAccountId != null ? String(body.payoutAccountId) : null;
    const commissionPct = Number(body.commissionPct ?? 5);
    const metadata = body.metadata != null ? body.metadata : {};

    try {
      const res = await pool.query<ProfileRow>(
        `INSERT INTO agent_profiles
           (id, agent_id, org_id, display_name, bio, avatar_url, archetype,
            specializations, personality_mode, payout_account_id, commission_pct, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb)
         RETURNING *`,
        [id, agentId, orgId, displayName, bio, avatarUrl, archetype,
         JSON.stringify(specializations), personalityMode,
         payoutAccountId, commissionPct, JSON.stringify(metadata)],
      );
      publishProfileEvent(nc ?? null, agentId, archetype, 'created');
      return reply.status(201).send({ success: true, data: { profile: toProfile(res.rows[0]) } });
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({ success: false, error: { code: 'DUPLICATE', message: 'agent_id already has a profile' } });
      }
      throw err;
    }
  });

  // --- Update agent profile ---
  app.patch<{ Params: { agentId: string } }>('/agent-profiles/:agentId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const body = req.body as Record<string, unknown> | undefined;
    if (!body) return reply.status(400).send({ success: false, error: { code: 'BAD_BODY' } });

    const sets: string[] = [];
    const params: unknown[] = [req.params.agentId, orgId];

    if (body.displayName != null) {
      params.push(String(body.displayName).slice(0, 200));
      sets.push(`display_name = $${params.length}`);
    }
    if (body.bio !== undefined) {
      params.push(body.bio != null ? String(body.bio).slice(0, 2000) : null);
      sets.push(`bio = $${params.length}`);
    }
    if (body.avatarUrl !== undefined) {
      params.push(body.avatarUrl != null ? String(body.avatarUrl).slice(0, 500) : null);
      sets.push(`avatar_url = $${params.length}`);
    }
    if (body.specializations != null && Array.isArray(body.specializations)) {
      params.push(JSON.stringify(body.specializations.map(String).slice(0, 20)));
      sets.push(`specializations = $${params.length}::jsonb`);
    }
    if (body.personalityMode != null) {
      params.push(String(body.personalityMode).slice(0, 40));
      sets.push(`personality_mode = $${params.length}`);
    }
    if (body.status != null && (VALID_STATUSES as readonly string[]).includes(String(body.status))) {
      params.push(String(body.status));
      sets.push(`status = $${params.length}`);
    }
    if (body.payoutAccountId !== undefined) {
      params.push(body.payoutAccountId != null ? String(body.payoutAccountId) : null);
      sets.push(`payout_account_id = $${params.length}`);
    }
    if (body.commissionPct != null) {
      const pct = Math.max(0, Math.min(100, Number(body.commissionPct)));
      params.push(pct);
      sets.push(`commission_pct = $${params.length}`);
    }
    if (body.metadata != null) {
      params.push(JSON.stringify(body.metadata));
      sets.push(`metadata = $${params.length}::jsonb`);
    }

    if (sets.length === 0) {
      return reply.status(400).send({ success: false, error: { code: 'NO_CHANGES' } });
    }

    sets.push('updated_at = NOW()');

    const res = await pool.query<ProfileRow>(
      `UPDATE agent_profiles SET ${sets.join(', ')}
       WHERE agent_id = $1 AND org_id = $2
       RETURNING *`,
      params,
    );
    if (!res.rows[0]) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    }
    const p = toProfile(res.rows[0]);
    publishProfileEvent(nc ?? null, p.agentId, p.archetype, 'updated');
    return { success: true, data: { profile: p } };
  });

  // --- Agent stats (listings, revenue, active automatons) ---
  app.get<{ Params: { agentId: string } }>('/agent-profiles/:agentId/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });

    const agentId = req.params.agentId;

    const [profileRes, listingsRes, automRes] = await Promise.all([
      pool.query(`SELECT id FROM agent_profiles WHERE agent_id = $1 AND org_id = $2 LIMIT 1`, [agentId, orgId]),
      pool.query(
        `SELECT COUNT(*)::int AS listing_count,
                COALESCE(SUM(total_sales), 0)::int AS total_sales,
                COALESCE(SUM(total_revenue), 0)::numeric AS total_revenue
         FROM marketplace_listings
         WHERE seller_agent_id = $1`,
        [agentId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS active_count
         FROM automatons
         WHERE org_id = $1 AND status IN ('born','working','cloning')
           AND metadata->>'agentId' = $2`,
        [orgId, agentId],
      ),
    ]);

    if (!profileRes.rows[0]) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
    }

    const ls = listingsRes.rows[0] ?? {};
    const am = automRes.rows[0] ?? {};

    return {
      success: true,
      data: {
        agentId,
        listingCount: Number(ls.listing_count) || 0,
        totalSales: Number(ls.total_sales) || 0,
        totalRevenue: Number(ls.total_revenue) || 0,
        activeAutomatons: Number(am.active_count) || 0,
      },
    };
  });
}

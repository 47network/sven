// ---------------------------------------------------------------------------
// Eidolon repository — read-only aggregation over Sven's economy tables.
// ---------------------------------------------------------------------------
// All queries are narrowly scoped (`org_id = $1`) and return only bounded,
// non-PII fields. Free-form user text (e.g. raw descriptions) is truncated
// at serialisation time in routes; never log or stream raw values.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import {
  districtFor,
  type District,
  type EidolonBuilding,
  type EidolonCitizen,
  type EidolonSnapshot,
  type EidolonTreasurySummary,
  listDistricts,
  positionFor,
} from './types.js';

const VERSION = '0.1.0';

export class EidolonRepository {
  constructor(private readonly pool: Pool) {}

  async getSnapshot(orgId: string): Promise<EidolonSnapshot> {
    const [listings, services, nodes, treasury, businessSpaces, crewHQs] = await Promise.all([
      this.fetchListings(orgId),
      this.fetchRevenueServices(orgId),
      this.fetchInfraNodes(orgId),
      this.fetchTreasurySummary(orgId),
      this.fetchBusinessBuildings(orgId),
      this.fetchCrewBuildings(orgId),
    ]);

    const buildings: EidolonBuilding[] = [
      ...listings,
      ...services,
      ...nodes,
      ...businessSpaces,
      ...crewHQs,
      this.buildTreasuryVault(treasury),
    ];

    const citizens = await this.fetchCitizens(orgId, buildings);

    return {
      generatedAt: new Date().toISOString(),
      buildings,
      citizens,
      treasury,
      meta: {
        version: VERSION,
        districts: listDistricts(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Buildings
  // -------------------------------------------------------------------------

  private async fetchListings(orgId: string): Promise<EidolonBuilding[]> {
    const { rows } = await this.pool.query<{
      id: string;
      title: string;
      status: string;
      total_sales: number;
      total_revenue: string;
    }>(
      `SELECT id, title, status, total_sales, total_revenue
       FROM marketplace_listings
       WHERE org_id = $1 AND status IN ('published','paused')
       ORDER BY total_revenue DESC
       LIMIT 200`,
      [orgId],
    );

    return rows.map((r) => {
      const revenue = Number(r.total_revenue) || 0;
      return {
        id: `listing:${r.id}`,
        kind: 'marketplace_listing' as const,
        label: safeLabel(r.title),
        district: districtFor('marketplace_listing'),
        position: positionFor(r.id, districtFor('marketplace_listing')),
        height: Math.min(60, 4 + Math.log10(1 + revenue) * 10),
        glow: r.status === 'published' ? Math.min(1, r.total_sales / 50) : 0,
        status: r.status === 'published' ? 'ok' : 'idle',
        metrics: { revenueUsd: revenue, salesCount: r.total_sales },
      };
    });
  }

  private async fetchRevenueServices(orgId: string): Promise<EidolonBuilding[]> {
    const existsRes = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'revenue_service_endpoints'
       ) AS exists`,
    );
    if (!existsRes.rows[0]?.exists) return [];

    const { rows } = await this.pool.query<{
      id: string;
      skill_name: string;
      total_calls: string;
      total_revenue: string;
      is_public: boolean;
      pipeline_status: string | null;
    }>(
      `SELECT rse.id, rse.skill_name, rse.total_calls, rse.total_revenue, rse.is_public,
              rp.status AS pipeline_status
       FROM revenue_service_endpoints rse
       JOIN revenue_pipelines rp ON rp.id = rse.pipeline_id
       WHERE rp.org_id = $1
       ORDER BY rse.total_revenue DESC
       LIMIT 200`,
      [orgId],
    );

    return rows.map((r) => {
      const revenue = Number(r.total_revenue) || 0;
      const calls = Number(r.total_calls) || 0;
      return {
        id: `service:${r.id}`,
        kind: 'revenue_service' as const,
        label: safeLabel(r.skill_name),
        district: districtFor('revenue_service'),
        position: positionFor(r.id, districtFor('revenue_service')),
        height: Math.min(80, 6 + Math.log10(1 + revenue) * 12),
        glow: r.pipeline_status === 'active' ? Math.min(1, calls / 500) : 0,
        status:
          r.pipeline_status === 'active'
            ? 'ok'
            : r.pipeline_status === 'paused'
              ? 'idle'
              : r.pipeline_status === 'error'
                ? 'degraded'
                : 'idle',
        metrics: { revenueUsd: revenue, salesCount: calls },
      };
    });
  }

  private async fetchInfraNodes(orgId: string): Promise<EidolonBuilding[]> {
    const existsRes = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'infra_nodes'
       ) AS exists`,
    );
    if (!existsRes.rows[0]?.exists) return [];

    const { rows } = await this.pool.query<{
      id: string;
      hostname: string;
      status: string;
      resources: Record<string, unknown>;
    }>(
      `SELECT id, hostname, status, resources
       FROM infra_nodes
       WHERE org_id = $1
       ORDER BY hostname
       LIMIT 100`,
      [orgId],
    );

    return rows.map((r) => {
      const cpuPct = numericFromResources(r.resources, 'cpu_pct');
      const memPct = numericFromResources(r.resources, 'mem_pct');
      const status: EidolonBuilding['status'] =
        r.status === 'healthy'
          ? 'ok'
          : r.status === 'degraded'
            ? 'degraded'
            : r.status === 'down'
              ? 'down'
              : 'idle';
      return {
        id: `node:${r.id}`,
        kind: 'infra_node' as const,
        label: safeLabel(r.hostname),
        district: districtFor('infra_node'),
        position: positionFor(r.id, districtFor('infra_node')),
        height: Math.min(50, 8 + (cpuPct ?? 0) * 0.3),
        glow: status === 'ok' ? Math.min(1, (cpuPct ?? 0) / 100) : 0,
        status,
        metrics: { cpuPct: cpuPct ?? undefined, memPct: memPct ?? undefined },
      };
    });
  }

  // ---- Agent business spaces (*.from.sven.systems) ----

  private async fetchBusinessBuildings(orgId: string): Promise<EidolonBuilding[]> {
    const existsRes = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'agent_business_endpoints'
       ) AS exists`,
    );
    if (!existsRes.rows[0]?.exists) return [];

    const { rows } = await this.pool.query<{
      agent_id: string;
      display_name: string;
      business_subdomain: string;
      total_requests: string;
      endpoint_status: string;
    }>(
      `SELECT ap.agent_id, ap.display_name, ap.business_subdomain,
              be.total_requests, be.status AS endpoint_status
       FROM agent_profiles ap
       JOIN agent_business_endpoints be ON be.agent_id = ap.agent_id
       WHERE ap.org_id = $1 AND ap.business_status = 'active'
       ORDER BY be.total_requests DESC
       LIMIT 100`,
      [orgId],
    );

    return rows.map((r) => {
      const requests = Number(r.total_requests) || 0;
      const status: EidolonBuilding['status'] =
        r.endpoint_status === 'healthy' ? 'ok'
        : r.endpoint_status === 'degraded' ? 'degraded'
        : r.endpoint_status === 'down' ? 'down'
        : 'idle';
      return {
        id: `biz:${r.agent_id}`,
        kind: 'agent_business' as const,
        label: safeLabel(`${r.display_name} (${r.business_subdomain}.from.sven.systems)`),
        district: districtFor('marketplace_listing'),
        position: positionFor(r.agent_id, districtFor('marketplace_listing')),
        height: Math.min(60, 10 + Math.log10(1 + requests) * 8),
        glow: status === 'ok' ? 1.0 : status === 'degraded' ? 0.3 : 0,
        status,
        metrics: { totalRequests: requests },
      };
    });
  }

  // ---- Agent crew headquarters ----

  private async fetchCrewBuildings(orgId: string): Promise<EidolonBuilding[]> {
    const existsRes = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'agent_crews'
       ) AS exists`,
    );
    if (!existsRes.rows[0]?.exists) return [];

    const { rows } = await this.pool.query<{
      id: string;
      name: string;
      crew_type: string;
      status: string;
      member_count: string;
    }>(
      `SELECT ac.id, ac.name, ac.crew_type, ac.status,
              COUNT(acm.agent_id)::text AS member_count
       FROM agent_crews ac
       LEFT JOIN agent_crew_members acm ON acm.crew_id = ac.id
       WHERE ac.org_id = $1 AND ac.status IN ('active','suspended')
       GROUP BY ac.id, ac.name, ac.crew_type, ac.status
       ORDER BY ac.name
       LIMIT 50`,
      [orgId],
    );

    return rows.map((r) => {
      const members = Number(r.member_count) || 0;
      const district = crewTypeToDistrict(r.crew_type);
      return {
        id: `crew:${r.id}`,
        kind: 'crew_headquarters' as const,
        label: safeLabel(`${r.name} (${members} members)`),
        district,
        position: positionFor(r.id, district),
        height: Math.min(80, 20 + members * 8),
        glow: r.status === 'active' ? 1.0 : 0.0,
        status: r.status === 'active' ? 'ok' : 'idle',
        metrics: { memberCount: members },
      };
    });
  }

  private buildTreasuryVault(treasury: EidolonTreasurySummary): EidolonBuilding {
    return {
      id: 'treasury:vault',
      kind: 'treasury_vault',
      label: 'Treasury Vault',
      district: districtFor('treasury_vault'),
      position: { x: 0, z: 0 },
      height: Math.min(120, 20 + Math.log10(1 + treasury.totalBalanceUsd) * 18),
      glow: treasury.openApprovals > 0 ? 1 : 0.7,
      status: 'ok',
      metrics: { revenueUsd: treasury.totalBalanceUsd },
    };
  }

  // -------------------------------------------------------------------------
  // Citizens (agents). Merges marketplace activity with agent_profiles when
  // available for richer identity (display name, archetype, bio, avatar).
  // Falls back gracefully if agent_profiles table doesn't exist yet.
  // -------------------------------------------------------------------------

  private async fetchCitizens(
    orgId: string,
    buildings: EidolonBuilding[],
  ): Promise<EidolonCitizen[]> {
    const listingsExists = buildings.some((b) => b.kind === 'marketplace_listing');
    if (!listingsExists) return [];

    const { rows } = await this.pool.query<{
      id: string;
      seller_agent_id: string | null;
      total_revenue: string;
      total_sales: number;
      status: string;
      display_name: string | null;
      archetype: string | null;
      bio: string | null;
      avatar_url: string | null;
      specializations: string[] | null;
    }>(
      `SELECT ml.id, ml.seller_agent_id, ml.total_revenue, ml.total_sales, ml.status,
              ap.display_name, ap.archetype, ap.bio, ap.avatar_url, ap.specializations
       FROM marketplace_listings ml
       LEFT JOIN agent_profiles ap ON ap.agent_id = ml.seller_agent_id AND ap.status = 'active'
       WHERE ml.org_id = $1 AND ml.seller_agent_id IS NOT NULL AND ml.status IN ('published','paused')
       ORDER BY ml.total_revenue DESC
       LIMIT 150`,
      [orgId],
    );

    const byAgent = new Map<string, EidolonCitizen>();
    for (const r of rows) {
      const agentId = r.seller_agent_id;
      if (!agentId) continue;
      const homeId = `listing:${r.id}`;
      const home = buildings.find((b) => b.id === homeId);
      const existing = byAgent.get(agentId);
      const earnings = Number(r.total_revenue) || 0;
      const sales = r.total_sales;
      if (existing) {
        existing.earningsUsd += earnings;
        existing.status = sales > 0 ? 'earning' : existing.status;
        continue;
      }
      const role = archetypeToRole(r.archetype);
      byAgent.set(agentId, {
        id: `agent:${agentId}`,
        label: r.display_name || safeLabel(agentId),
        role,
        position: home
          ? { x: home.position.x + 2, z: home.position.z + 2 }
          : positionFor(agentId, 'market'),
        homeBuildingId: homeId,
        status:
          r.status !== 'published'
            ? 'retiring'
            : sales > 0
              ? 'earning'
              : 'working',
        earningsUsd: earnings,
        archetype: r.archetype ?? undefined,
        bio: r.bio ?? undefined,
        avatarUrl: r.avatar_url ?? undefined,
        specializations: r.specializations ?? undefined,
      });
    }

    return [...byAgent.values()];
  }

  // -------------------------------------------------------------------------
  // Treasury summary
  // -------------------------------------------------------------------------

  private async fetchTreasurySummary(orgId: string): Promise<EidolonTreasurySummary> {
    const existsRes = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'treasury_accounts'
       ) AS exists`,
    );
    if (!existsRes.rows[0]?.exists) {
      return { totalBalanceUsd: 0, byKind: {}, lastSettlementAt: null, openApprovals: 0 };
    }

    const [balRes, lastTxRes] = await Promise.all([
      this.pool.query<{ kind: string; total: string }>(
        `SELECT kind, COALESCE(SUM(balance), 0) AS total
         FROM treasury_accounts
         WHERE org_id = $1 AND currency = 'USD' AND frozen = false
         GROUP BY kind`,
        [orgId],
      ),
      this.pool.query<{ created_at: string | null }>(
        `SELECT MAX(created_at) AS created_at
         FROM treasury_transactions
         WHERE org_id = $1`,
        [orgId],
      ),
    ]);

    const byKind: Record<string, number> = {};
    let total = 0;
    for (const r of balRes.rows) {
      const n = Number(r.total) || 0;
      byKind[r.kind] = n;
      total += n;
    }

    return {
      totalBalanceUsd: total,
      byKind,
      lastSettlementAt: lastTxRes.rows[0]?.created_at ?? null,
      openApprovals: 0,
    };
  }
}

// ---- internal helpers -----------------------------------------------------

const ARCHETYPE_ROLE_MAP: Record<string, EidolonCitizen['role']> = {
  seller: 'seller',
  translator: 'translator',
  writer: 'writer',
  scout: 'scout',
  analyst: 'worker',
  operator: 'operator',
  accountant: 'accountant',
  marketer: 'marketer',
  researcher: 'researcher',
  legal: 'counsel',
  designer: 'designer',
  support: 'support',
  strategist: 'strategist',
  recruiter: 'recruiter',
  custom: 'pipeline',
};

function archetypeToRole(archetype: string | null | undefined): EidolonCitizen['role'] {
  if (!archetype) return 'pipeline';
  return ARCHETYPE_ROLE_MAP[archetype] ?? 'pipeline';
}

function safeLabel(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';
  const cleaned = trimmed.replace(/[\u0000-\u001f\u007f]/g, '');
  return cleaned.length > 48 ? `${cleaned.slice(0, 45)}…` : cleaned;
}

function numericFromResources(
  resources: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!resources || typeof resources !== 'object') return null;
  const v = (resources as Record<string, unknown>)[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

const CREW_DISTRICT_MAP: Record<string, District> = {
  publishing: 'market',
  research: 'revenue',
  operations: 'infra',
  marketing: 'market',
  legal_compliance: 'treasury',
  custom: 'revenue',
};

function crewTypeToDistrict(crewType: string): District {
  return CREW_DISTRICT_MAP[crewType] ?? 'revenue';
}

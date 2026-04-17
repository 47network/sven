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
    const [listings, services, nodes, treasury] = await Promise.all([
      this.fetchListings(orgId),
      this.fetchRevenueServices(orgId),
      this.fetchInfraNodes(orgId),
      this.fetchTreasurySummary(orgId),
    ]);

    const buildings: EidolonBuilding[] = [
      ...listings,
      ...services,
      ...nodes,
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
  // Citizens (agents). Derived from recent revenue + marketplace activity
  // until a first-class agent registry exists. Deterministic positions anchor
  // each citizen near their home building.
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
    }>(
      `SELECT id, seller_agent_id, total_revenue, total_sales, status
       FROM marketplace_listings
       WHERE org_id = $1 AND seller_agent_id IS NOT NULL AND status IN ('published','paused')
       ORDER BY total_revenue DESC
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
      byAgent.set(agentId, {
        id: `agent:${agentId}`,
        label: safeLabel(agentId),
        role: 'pipeline',
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

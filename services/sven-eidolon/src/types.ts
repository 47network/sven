// ---------------------------------------------------------------------------
// Eidolon types — 3D city projection of Sven's autonomous economy
// ---------------------------------------------------------------------------
// All coordinates are deterministic from the entity id (djb2 hash) so the
// city layout is stable across snapshots without requiring layout state in
// the DB. UI is free to re-map, but these defaults keep terminals + 3D in
// sync for debugging.
// ---------------------------------------------------------------------------

export type EidolonBuildingKind =
  | 'marketplace_listing'
  | 'revenue_service'
  | 'infra_node'
  | 'treasury_vault';

export interface EidolonBuilding {
  id: string;
  kind: EidolonBuildingKind;
  label: string;
  district: string;
  position: { x: number; z: number };
  height: number;
  glow: number;
  status: 'ok' | 'degraded' | 'down' | 'idle';
  metrics: {
    revenueUsd?: number;
    salesCount?: number;
    cpuPct?: number;
    memPct?: number;
  };
}

export interface EidolonCitizen {
  id: string;
  label: string;
  role: 'pipeline' | 'worker' | 'scout' | 'treasurer' | 'operator' | 'seller' | 'translator' | 'writer';
  position: { x: number; z: number };
  homeBuildingId: string | null;
  status: 'idle' | 'working' | 'earning' | 'retiring';
  earningsUsd: number;
  archetype?: string;
  bio?: string;
  avatarUrl?: string;
  specializations?: string[];
}

export interface EidolonTreasurySummary {
  totalBalanceUsd: number;
  byKind: Record<string, number>;
  lastSettlementAt: string | null;
  openApprovals: number;
}

export interface EidolonSnapshot {
  generatedAt: string;
  buildings: EidolonBuilding[];
  citizens: EidolonCitizen[];
  treasury: EidolonTreasurySummary;
  meta: {
    version: string;
    districts: string[];
  };
}

export type EidolonEventKind =
  | 'market.listing_published'
  | 'market.order_paid'
  | 'market.fulfilled'
  | 'market.refunded'
  | 'treasury.credit'
  | 'treasury.debit'
  | 'agent.spawned'
  | 'agent.retired'
  | 'agent.profile_updated'
  | 'infra.node_change'
  | 'heartbeat';

export interface EidolonEvent {
  id: string;
  at: string;
  kind: EidolonEventKind;
  // Bounded, sanitised payload — never raw PII or free-form user text.
  payload: Record<string, string | number | boolean | null>;
}

// ---- Deterministic layout helpers ----------------------------------------

const DISTRICTS = ['market', 'revenue', 'infra', 'treasury'] as const;
export type District = (typeof DISTRICTS)[number];

export function listDistricts(): string[] {
  return [...DISTRICTS];
}

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const DISTRICT_CENTRES: Record<District, { cx: number; cz: number }> = {
  treasury: { cx: 0, cz: 0 },
  market: { cx: -80, cz: -40 },
  revenue: { cx: 80, cz: -40 },
  infra: { cx: 0, cz: 80 },
};

export function positionFor(entityId: string, district: District): { x: number; z: number } {
  const hash = djb2(`${district}:${entityId}`);
  const centre = DISTRICT_CENTRES[district];
  const ring = 20 + ((hash >>> 3) % 40);
  const angle = ((hash & 0x3ff) / 0x3ff) * Math.PI * 2;
  return {
    x: Math.round(centre.cx + Math.cos(angle) * ring),
    z: Math.round(centre.cz + Math.sin(angle) * ring),
  };
}

export function districtFor(kind: EidolonBuildingKind): District {
  switch (kind) {
    case 'marketplace_listing':
      return 'market';
    case 'revenue_service':
      return 'revenue';
    case 'infra_node':
      return 'infra';
    case 'treasury_vault':
      return 'treasury';
  }
}

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
  role: 'pipeline' | 'worker' | 'scout' | 'treasurer' | 'operator';
  position: { x: number; z: number };
  homeBuildingId: string | null;
  status: 'idle' | 'working' | 'earning' | 'retiring';
  earningsUsd: number;
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
  meta: { version: string; districts: string[] };
}

export type EidolonEventKind =
  | 'market.listing_published'
  | 'market.order_paid'
  | 'market.fulfilled'
  | 'treasury.credit'
  | 'treasury.debit'
  | 'agent.spawned'
  | 'agent.retired'
  | 'infra.node_change'
  | 'heartbeat';

export interface EidolonEvent {
  id: string;
  at: string;
  kind: EidolonEventKind;
  payload: Record<string, string | number | boolean | null>;
}

export async function fetchSnapshot(orgId: string, signal?: AbortSignal): Promise<EidolonSnapshot> {
  const res = await fetch(`/v1/eidolon/snapshot?orgId=${encodeURIComponent(orgId)}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`snapshot_http_${res.status}`);
  return (await res.json()) as EidolonSnapshot;
}

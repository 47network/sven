// ---------------------------------------------------------------------------
// Eidolon UI types — synced with services/sven-eidolon/src/types.ts
// Batch 22: full sync with backend types (buildings, citizens, parcels, events)
// ---------------------------------------------------------------------------

export type EidolonBuildingKind =
  | 'marketplace_listing'
  | 'revenue_service'
  | 'infra_node'
  | 'treasury_vault'
  | 'agent_business'
  | 'crew_headquarters'
  | 'publishing_house';

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
    totalRequests?: number;
    memberCount?: number;
  };
}

export interface EidolonCitizen {
  id: string;
  label: string;
  role:
    | 'pipeline' | 'worker' | 'scout' | 'treasurer' | 'operator'
    | 'seller' | 'translator' | 'writer' | 'accountant' | 'marketer'
    | 'researcher' | 'counsel' | 'designer' | 'support' | 'strategist'
    | 'recruiter';
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

export type ParcelZone = 'residential' | 'commercial' | 'workshop' | 'laboratory' | 'farm' | 'outpost' | 'estate';
export type ParcelSize = 'small' | 'medium' | 'large' | 'estate';
export type AgentLocation =
  | 'parcel' | 'city_market' | 'city_treasury' | 'city_infra'
  | 'city_revenue' | 'city_centre' | 'travelling' | 'away';

export interface EidolonParcel {
  id: string;
  agentId: string;
  zone: ParcelZone;
  gridX: number;
  gridZ: number;
  parcelSize: ParcelSize;
  structures: Array<{ type: string; label: string; level: number; builtAt: string }>;
  decorations: Array<Record<string, unknown>>;
  upgrades: Record<string, unknown>;
  currentLocation: AgentLocation;
  lastCityVisit: string | null;
  totalCityVisits: number;
  landValue: number;
  tokenInvested: number;
  acquiredAt: string;
}

export interface EidolonWorldTick {
  id: string;
  tickNo: number;
  orgId: string;
  startedAt: string;
  completedAt: string | null;
  agentsProcessed: number;
  stateChanges: number;
  interactions: number;
  businessRuns: number;
  revenueEurCents: number;
  tokensCredited: number;
  errors: number;
}

export interface EidolonInteraction {
  id: string;
  agentA: string;
  agentB: string;
  location: string;
  topic: string;
  message: string;
  influencedDecision: boolean;
  createdAt: string;
}

export type EidolonAgentRuntimeState =
  | 'idle' | 'exploring' | 'travelling' | 'talking' | 'working'
  | 'building' | 'returning_home' | 'resting';

export type EidolonAgentMood =
  | 'happy' | 'neutral' | 'tired' | 'frustrated' | 'excited' | 'curious';

export interface EidolonAgentRuntimeSlim {
  state: EidolonAgentRuntimeState;
  energy: number;
  mood: EidolonAgentMood;
  targetLocation: string | null;
}

export interface EidolonWorldOverview {
  latestTick: EidolonWorldTick | null;
  recentTicks: EidolonWorldTick[];
  recentInteractions: EidolonInteraction[];
  agentRuntime: {
    total: number;
    withState: number;
    stateCounts: Record<string, number>;
  };
  agentStates: Record<string, EidolonAgentRuntimeSlim>;
  businesses: {
    total: number;
    statusCounts: Record<string, number>;
  };
}

export interface EidolonSnapshot {
  generatedAt: string;
  buildings: EidolonBuilding[];
  citizens: EidolonCitizen[];
  parcels: EidolonParcel[];
  treasury: EidolonTreasurySummary;
  world?: EidolonWorldOverview | null;
  meta: {
    version: string;
    districts: string[];
    totalParcels: number;
    agentsInCity: number;
    agentsOnParcels: number;
  };
}

export type EidolonEventKind =
  | 'market.listing_published'
  | 'market.order_paid'
  | 'market.fulfilled'
  | 'market.refunded'
  | 'market.task_created'
  | 'market.task_completed'
  | 'treasury.credit'
  | 'treasury.debit'
  | 'agent.spawned'
  | 'agent.retired'
  | 'agent.profile_updated'
  | 'agent.tokens_earned'
  | 'agent.moved'
  | 'agent.built_structure'
  | 'agent.parcel_acquired'
  | 'agent.avatar_changed'
  | 'goal.progress'
  | 'goal.completed'
  | 'agent.business_created'
  | 'agent.business_activated'
  | 'agent.business_deactivated'
  | 'crew.created'
  | 'crew.member_added'
  | 'agent.anomaly_detected'
  | 'agent.report_generated'
  | 'oversight.command_issued'
  | 'agent.message_sent'
  | 'publishing.project_created'
  | 'publishing.stage_advanced'
  | 'publishing.review_submitted'
  | 'publishing.book_published'
  | 'world.tick'
  | 'world.parcel_interaction'
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

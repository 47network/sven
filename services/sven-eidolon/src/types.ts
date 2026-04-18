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
  | 'treasury_vault'
  | 'agent_business'
  | 'crew_headquarters'
  | 'publishing_house'
  | 'recruitment_center'
  | 'print_works'
  | 'media_studio'
  | 'xlvii_storefront';

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
  role: 'pipeline' | 'worker' | 'scout' | 'treasurer' | 'operator' | 'seller' | 'translator' | 'writer' | 'accountant' | 'marketer' | 'researcher' | 'counsel' | 'designer' | 'support' | 'strategist' | 'recruiter';
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

export interface EidolonSnapshot {
  generatedAt: string;
  buildings: EidolonBuilding[];
  citizens: EidolonCitizen[];
  parcels: EidolonParcel[];
  treasury: EidolonTreasurySummary;
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
  | 'agent.avatar_changed'
  | 'world.tick'
  | 'world.parcel_interaction'
  | 'infra.node_change'
  | 'misiuni.task_created'
  | 'misiuni.bid_accepted'
  | 'misiuni.proof_submitted'
  | 'misiuni.task_verified'
  | 'misiuni.payment_released'
  | 'publishing.print_order_created'
  | 'publishing.print_order_shipped'
  | 'publishing.legal_requirement_added'
  | 'publishing.genre_trend_discovered'
  | 'publishing.author_persona_created'
  | 'publishing.printer_proposal_submitted'
  | 'social.account_connected'
  | 'social.post_created'
  | 'social.post_published'
  | 'social.campaign_started'
  | 'social.engagement_milestone'
  | 'xlvii.collection_created'
  | 'xlvii.product_created'
  | 'xlvii.design_created'
  | 'xlvii.design_approved'
  | 'xlvii.fulfillment_shipped'
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
    case 'agent_business':
      return 'market';
    case 'crew_headquarters':
      return 'market'; // default; overridden per crew type in repo.ts
    case 'publishing_house':
      return 'market';
    case 'recruitment_center':
      return 'market';
    case 'print_works':
      return 'market';
    case 'media_studio':
      return 'market';
    case 'xlvii_storefront':
      return 'market';
  }
}

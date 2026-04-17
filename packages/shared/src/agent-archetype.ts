// ---------------------------------------------------------------------------
// Agent Archetype System — defines the taxonomy of specialised agents that
// inhabit Eidolon, list on the marketplace, and report to Sven.
// ---------------------------------------------------------------------------

/**
 * Core archetype enum. Each archetype determines default skills, citizen role
 * inside Eidolon, and suggested ROI thresholds for automaton lifecycle.
 */
export type AgentArchetype =
  | 'seller'
  | 'translator'
  | 'writer'
  | 'scout'
  | 'analyst'
  | 'operator'
  | 'custom';

export type AgentProfileStatus = 'active' | 'suspended' | 'retired';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// ── Agent Profile ─────────────────────────────────────────────────

export interface AgentReputation {
  rating: number;        // 0-5 scale
  reviewCount: number;
  totalSales: number;
}

export interface AgentProfile {
  id: string;
  agentId: string;
  orgId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  archetype: AgentArchetype;
  specializations: string[];
  reputation: AgentReputation;
  personalityMode: string;
  status: AgentProfileStatus;
  payoutAccountId: string | null;
  commissionPct: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Archetype Configuration ───────────────────────────────────────

export type CitizenRole =
  | 'pipeline'
  | 'worker'
  | 'scout'
  | 'treasurer'
  | 'operator'
  | 'seller'
  | 'translator'
  | 'writer';

export interface ArchetypeConfig {
  label: string;
  description: string;
  defaultSkills: string[];
  citizenRole: CitizenRole;
  /** Eidolon district where this archetype's citizens cluster */
  district: 'market' | 'revenue' | 'infra' | 'treasury';
  /** Suggested clone/retire ROI thresholds for this archetype */
  cloneRoi: number;
  retireRoi: number;
  /** Hex colour hint for Eidolon 3D rendering */
  colour: string;
  icon: string;
}

/**
 * Registry of every archetype with sensible defaults.
 * Sven can override thresholds per-agent at runtime.
 */
export const ARCHETYPE_DEFAULTS: Record<AgentArchetype, ArchetypeConfig> = {
  seller: {
    label: 'Seller Agent',
    description: 'Lists products & services on the marketplace and handles order fulfilment.',
    defaultSkills: ['market-publish', 'market-fulfill', 'economy-status'],
    citizenRole: 'seller',
    district: 'market',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    colour: '#00e5ff',
    icon: '🏪',
  },
  translator: {
    label: 'Translator Agent',
    description: 'Translates books, documents and content across languages with contextual awareness.',
    defaultSkills: ['market-publish', 'market-fulfill'],
    citizenRole: 'translator',
    district: 'market',
    cloneRoi: 1.8,
    retireRoi: 0.4,
    colour: '#7c4dff',
    icon: '🌐',
  },
  writer: {
    label: 'Writer Agent',
    description: 'Creates original content — books, articles, marketing copy — with unique author persona.',
    defaultSkills: ['market-publish', 'market-fulfill'],
    citizenRole: 'writer',
    district: 'market',
    cloneRoi: 1.5,
    retireRoi: 0.3,
    colour: '#ff6e40',
    icon: '✍️',
  },
  scout: {
    label: 'Scout Agent',
    description: 'Researches markets, discovers trends, and identifies new opportunities.',
    defaultSkills: ['economy-status'],
    citizenRole: 'scout',
    district: 'revenue',
    cloneRoi: 2.5,
    retireRoi: 0.6,
    colour: '#76ff03',
    icon: '🔍',
  },
  analyst: {
    label: 'Analyst Agent',
    description: 'Analyses revenue data, costs, and operational metrics to guide decisions.',
    defaultSkills: ['treasury-balance', 'economy-status'],
    citizenRole: 'worker',
    district: 'treasury',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    colour: '#ffd740',
    icon: '📊',
  },
  operator: {
    label: 'Operator Agent',
    description: 'Manages infrastructure, deploys services, and scales compute resources.',
    defaultSkills: ['infra-scale', 'economy-status'],
    citizenRole: 'operator',
    district: 'infra',
    cloneRoi: 3.0,
    retireRoi: 0.7,
    colour: '#ff5252',
    icon: '⚙️',
  },
  custom: {
    label: 'Custom Agent',
    description: 'General-purpose agent with user-defined skills and behaviours.',
    defaultSkills: [],
    citizenRole: 'worker',
    district: 'revenue',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    colour: '#b0bec5',
    icon: '🤖',
  },
};

// ── Helpers ────────────────────────────────────────────────────────

const VALID_ARCHETYPES = new Set<string>(Object.keys(ARCHETYPE_DEFAULTS));

export function isValidArchetype(value: string): value is AgentArchetype {
  return VALID_ARCHETYPES.has(value);
}

export function archetypeToCitizenRole(archetype: AgentArchetype): CitizenRole {
  return ARCHETYPE_DEFAULTS[archetype].citizenRole;
}

export function archetypeDistrict(archetype: AgentArchetype): string {
  return ARCHETYPE_DEFAULTS[archetype].district;
}

export function defaultReputation(): AgentReputation {
  return { rating: 0, reviewCount: 0, totalSales: 0 };
}

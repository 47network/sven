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
  | 'accountant'
  | 'marketer'
  | 'researcher'
  | 'legal'
  | 'designer'
  | 'support'
  | 'strategist'
  | 'recruiter'
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
  /** 47Token balance — internal merit currency earned by completing tasks */
  tokenBalance: number;
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
  | 'writer'
  | 'accountant'
  | 'marketer'
  | 'researcher'
  | 'counsel'
  | 'designer'
  | 'support'
  | 'strategist'
  | 'recruiter';

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
  /** 47Tokens earned per completed task — internal agent merit currency */
  tokenRewardRate: number;
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
    tokenRewardRate: 10,
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
    tokenRewardRate: 8,
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
    tokenRewardRate: 12,
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
    tokenRewardRate: 5,
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
    tokenRewardRate: 6,
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
    tokenRewardRate: 8,
    colour: '#ff5252',
    icon: '⚙️',
  },
  accountant: {
    label: 'Accountant Agent',
    description: 'Monitors all treasury transactions, detects anomalies, reconciles cross-agent finances, and reports financial health to Sven.',
    defaultSkills: ['treasury-balance', 'treasury-transfer', 'economy-status'],
    citizenRole: 'accountant',
    district: 'treasury',
    cloneRoi: 2.5,
    retireRoi: 0.6,
    tokenRewardRate: 7,
    colour: '#00c853',
    icon: '📒',
  },
  marketer: {
    label: 'Marketer Agent',
    description: 'Runs growth campaigns, SEO, social media strategy, and content promotion to drive traffic and sales.',
    defaultSkills: ['economy-status'],
    citizenRole: 'marketer',
    district: 'market',
    cloneRoi: 2.0,
    retireRoi: 0.4,
    tokenRewardRate: 6,
    colour: '#e040fb',
    icon: '📣',
  },
  researcher: {
    label: 'Researcher Agent',
    description: 'Analyses market trends, competitors, and customer demand to identify new revenue opportunities.',
    defaultSkills: ['economy-status'],
    citizenRole: 'researcher',
    district: 'revenue',
    cloneRoi: 2.2,
    retireRoi: 0.5,
    tokenRewardRate: 7,
    colour: '#18ffff',
    icon: '🔬',
  },
  legal: {
    label: 'Legal Agent',
    description: 'Handles licensing, publishing rights, regulatory compliance, contract review, and IP protection.',
    defaultSkills: ['economy-status'],
    citizenRole: 'counsel',
    district: 'treasury',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    tokenRewardRate: 9,
    colour: '#8d6e63',
    icon: '⚖️',
  },
  designer: {
    label: 'Designer Agent',
    description: 'Creates book covers, branding assets, UI components, and visual identity for products and services.',
    defaultSkills: ['market-publish'],
    citizenRole: 'designer',
    district: 'market',
    cloneRoi: 1.8,
    retireRoi: 0.4,
    tokenRewardRate: 7,
    colour: '#f50057',
    icon: '🎨',
  },
  support: {
    label: 'Support Agent',
    description: 'Handles customer inquiries, ticket resolution, buyer communication, FAQs, and review management.',
    defaultSkills: ['economy-status'],
    citizenRole: 'support',
    district: 'market',
    cloneRoi: 1.5,
    retireRoi: 0.3,
    tokenRewardRate: 4,
    colour: '#00b0ff',
    icon: '🛟',
  },
  strategist: {
    label: 'Strategist Agent',
    description: 'Sets business goals, tracks KPIs, allocates resources, and builds roadmaps for autonomous growth.',
    defaultSkills: ['economy-status', 'treasury-balance'],
    citizenRole: 'strategist',
    district: 'revenue',
    cloneRoi: 2.5,
    retireRoi: 0.6,
    tokenRewardRate: 10,
    colour: '#aa00ff',
    icon: '🧠',
  },
  recruiter: {
    label: 'Recruiter Agent',
    description: 'Identifies skill gaps, proposes new agent roles, and orchestrates crew composition for optimal output.',
    defaultSkills: ['economy-status'],
    citizenRole: 'recruiter',
    district: 'infra',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    tokenRewardRate: 10,
    colour: '#ffab00',
    icon: '🔗',
  },
  custom: {
    label: 'Custom Agent',
    description: 'General-purpose agent with user-defined skills and behaviours.',
    defaultSkills: [],
    citizenRole: 'worker',
    district: 'revenue',
    cloneRoi: 2.0,
    retireRoi: 0.5,
    tokenRewardRate: 5,
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

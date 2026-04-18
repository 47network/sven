/**
 * Agent Crews — team definitions, messaging types, anomaly types,
 * and performance report interfaces for Sven's autonomous economy.
 *
 * Crews let agents naturally form business teams (publishing, research,
 * operations, etc.). The accountant module uses anomaly types to flag
 * financial irregularities. Performance reports track per-agent metrics.
 */

import type { AgentArchetype } from './agent-archetype.js';

// ────────────────────────────── Crew Types ──────────────────────────────

export type CrewType =
  | 'publishing'
  | 'research'
  | 'operations'
  | 'marketing'
  | 'legal_compliance'
  | 'custom';

export type CrewStatus = 'active' | 'suspended' | 'disbanded';

export type CrewMemberRole = 'lead' | 'member' | 'specialist' | 'observer';

export interface CrewTemplate {
  type: CrewType;
  label: string;
  description: string;
  suggestedArchetypes: AgentArchetype[];
  minMembers: number;
  maxMembers: number;
  icon: string;
}

export const CREW_TEMPLATES: Record<CrewType, CrewTemplate> = {
  publishing: {
    type: 'publishing',
    label: 'Publishing Crew',
    description:
      'End-to-end book publishing: writing, translation, design, legal review, and marketing.',
    suggestedArchetypes: ['writer', 'translator', 'designer', 'legal', 'marketer', 'support'],
    minMembers: 2,
    maxMembers: 10,
    icon: '📚',
  },
  research: {
    type: 'research',
    label: 'Research Crew',
    description:
      'Market analysis, trend discovery, and strategic insights for revenue growth.',
    suggestedArchetypes: ['researcher', 'analyst', 'scout', 'strategist'],
    minMembers: 2,
    maxMembers: 8,
    icon: '🔬',
  },
  operations: {
    type: 'operations',
    label: 'Operations Crew',
    description:
      'Infrastructure management, financial oversight, and operational support.',
    suggestedArchetypes: ['operator', 'accountant', 'support', 'recruiter'],
    minMembers: 2,
    maxMembers: 8,
    icon: '⚙️',
  },
  marketing: {
    type: 'marketing',
    label: 'Marketing Crew',
    description:
      'Growth campaigns, brand management, content promotion, and customer acquisition.',
    suggestedArchetypes: ['marketer', 'designer', 'strategist', 'writer'],
    minMembers: 2,
    maxMembers: 8,
    icon: '📣',
  },
  legal_compliance: {
    type: 'legal_compliance',
    label: 'Legal & Compliance Crew',
    description:
      'Regulatory research, contract review, financial auditing, and risk assessment.',
    suggestedArchetypes: ['legal', 'accountant', 'analyst'],
    minMembers: 2,
    maxMembers: 6,
    icon: '⚖️',
  },
  custom: {
    type: 'custom',
    label: 'Custom Crew',
    description: 'User-defined crew with flexible composition.',
    suggestedArchetypes: [],
    minMembers: 1,
    maxMembers: 15,
    icon: '🔧',
  },
};

export const ALL_CREW_TYPES: CrewType[] = Object.keys(CREW_TEMPLATES) as CrewType[];

// ────────────────────────────── Messaging ──────────────────────────────

export type MessageType =
  | 'info'
  | 'alert'
  | 'anomaly'
  | 'report'
  | 'command'
  | 'task_update';

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | null;
  crewId: string | null;
  subject: string;
  body: string;
  messageType: MessageType;
  priority: MessagePriority;
  readAt: string | null;
  createdAt: string;
}

// ────────────────────────────── Anomalies ──────────────────────────────

export type AnomalyType =
  | 'unusual_amount'
  | 'frequency_spike'
  | 'revenue_drop'
  | 'cost_overrun'
  | 'dormant_agent'
  | 'threshold_breach'
  | 'pattern_deviation';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export interface AgentAnomaly {
  id: string;
  detectedBy: string;
  targetAgentId: string | null;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  evidence: Record<string, unknown>;
  status: AnomalyStatus;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export const ALL_ANOMALY_TYPES: AnomalyType[] = [
  'unusual_amount',
  'frequency_spike',
  'revenue_drop',
  'cost_overrun',
  'dormant_agent',
  'threshold_breach',
  'pattern_deviation',
];

// ────────────────────────────── Performance ──────────────────────────────

export interface AgentPerformanceReport {
  id: string;
  agentId: string;
  periodStart: string;
  periodEnd: string;
  tasksCompleted: number;
  tasksFailed: number;
  revenueGenerated: number;
  tokensEarned: number;
  anomaliesDetected: number;
  reportData: Record<string, unknown>;
  createdAt: string;
}

// ────────────────────────────── Oversight Commands ──────────────────────

export type OversightCommandType =
  | 'suspend'
  | 'resume'
  | 'prioritize'
  | 'deprioritize'
  | 'reassign'
  | 'review';

export interface OversightCommand {
  targetAgentId: string;
  commandType: OversightCommandType;
  payload: Record<string, unknown>;
  reason: string;
}

// ────────────────────────────── Crew DB Row ──────────────────────────────

export interface CrewRow {
  id: string;
  org_id: string;
  name: string;
  crew_type: CrewType;
  description: string | null;
  lead_agent_id: string | null;
  status: CrewStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrewMemberRow {
  crew_id: string;
  agent_id: string;
  role_in_crew: CrewMemberRole;
  joined_at: string;
}

/**
 * Map crew type → Eidolon district for building placement.
 */
export function crewDistrict(type: CrewType): 'market' | 'revenue' | 'infra' | 'treasury' {
  switch (type) {
    case 'publishing':
    case 'marketing':
      return 'market';
    case 'research':
      return 'revenue';
    case 'operations':
      return 'infra';
    case 'legal_compliance':
      return 'treasury';
    case 'custom':
    default:
      return 'revenue';
  }
}

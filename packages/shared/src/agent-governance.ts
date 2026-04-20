/* Batch 43 — Agent Governance & Voting — shared types */

export type ProposalType =
  | 'standard'
  | 'constitutional'
  | 'emergency'
  | 'budget'
  | 'election'
  | 'policy'
  | 'technical'
  | 'expulsion';

export type ProposalCategory =
  | 'general'
  | 'economy'
  | 'infrastructure'
  | 'security'
  | 'membership'
  | 'research'
  | 'collaboration';

export type AgentgProposalStatus =
  | 'draft'
  | 'review'
  | 'voting'
  | 'passed'
  | 'rejected'
  | 'executed'
  | 'vetoed'
  | 'expired';

export type VoteChoice =
  | 'for'
  | 'against'
  | 'abstain';

export type CouncilType =
  | 'general'
  | 'technical'
  | 'economic'
  | 'security'
  | 'research'
  | 'ethics';

export type CouncilRole =
  | 'chair'
  | 'vice_chair'
  | 'secretary'
  | 'member'
  | 'observer';

export type DelegationScope =
  | 'all'
  | 'economy'
  | 'infrastructure'
  | 'security'
  | 'membership'
  | 'research';

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  category: ProposalCategory;
  status: AgentgProposalStatus;
  proposerId: string;
  councilId?: string;
  quorum: number;
  threshold: number;
  votingStart?: string;
  votingEnd?: string;
  result?: string;
  execution: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceVote {
  id: string;
  proposalId: string;
  voterId: string;
  vote: VoteChoice;
  weight: number;
  reason?: string;
  delegatedBy?: string;
  createdAt: string;
}

export interface GovernanceCouncil {
  id: string;
  name: string;
  description?: string;
  councilType: CouncilType;
  memberLimit: number;
  termLengthDays: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceDelegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  scope: DelegationScope;
  councilId?: string;
  active: boolean;
  createdAt: string;
  revokedAt?: string;
}

/* ── Constants ──────────────────────────────────────────────── */

export const PROPOSAL_TYPES: ProposalType[] = [
  'standard', 'constitutional', 'emergency', 'budget',
  'election', 'policy', 'technical', 'expulsion',
];

export const PROPOSAL_CATEGORIES: ProposalCategory[] = [
  'general', 'economy', 'infrastructure', 'security',
  'membership', 'research', 'collaboration',
];

export const PROPOSAL_STATUSES: AgentgProposalStatus[] = [
  'draft', 'review', 'voting', 'passed',
  'rejected', 'executed', 'vetoed', 'expired',
];

export const VOTE_CHOICES: VoteChoice[] = ['for', 'against', 'abstain'];

export const COUNCIL_TYPES: CouncilType[] = [
  'general', 'technical', 'economic', 'security', 'research', 'ethics',
];

export const COUNCIL_ROLES: CouncilRole[] = [
  'chair', 'vice_chair', 'secretary', 'member', 'observer',
];

/* ── Helpers ────────────────────────────────────────────────── */

export function hasQuorum(
  totalEligible: number,
  totalVoted: number,
  quorum: number,
): boolean {
  if (totalEligible <= 0) return false;
  return totalVoted / totalEligible >= quorum;
}

export function calculateResult(
  votesFor: number,
  votesAgainst: number,
  threshold: number,
): 'passed' | 'rejected' {
  const total = votesFor + votesAgainst;
  if (total <= 0) return 'rejected';
  return votesFor / total >= threshold ? 'passed' : 'rejected';
}

export function getVoteWeight(
  reputationScore: number,
  baseWeight: number = 1.0,
): number {
  const multiplier = 1 + (reputationScore / 100) * 0.5;
  return Math.round(baseWeight * multiplier * 100) / 100;
}

export function isVotingOpen(proposal: GovernanceProposal): boolean {
  if (proposal.status !== 'voting') return false;
  const now = Date.now();
  if (proposal.votingStart && new Date(proposal.votingStart).getTime() > now) return false;
  if (proposal.votingEnd && new Date(proposal.votingEnd).getTime() < now) return false;
  return true;
}

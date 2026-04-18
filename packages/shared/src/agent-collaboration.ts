// ---------------------------------------------------------------------------
// Agent Collaboration & Social Dynamics — shared types for Batch 40
// ---------------------------------------------------------------------------

export type CollaborationType =
  | 'joint_project'
  | 'mentorship'
  | 'peer_review'
  | 'knowledge_share'
  | 'skill_exchange'
  | 'resource_pooling'
  | 'co_creation'
  | 'delegation';

export type CollaborationStatus =
  | 'proposed'
  | 'negotiating'
  | 'active'
  | 'paused'
  | 'completed'
  | 'dissolved'
  | 'rejected';

export type TeamType =
  | 'project'
  | 'guild'
  | 'squad'
  | 'council'
  | 'research_group'
  | 'service_crew'
  | 'trading_desk'
  | 'creative_studio';

export type TeamStatus = 'forming' | 'active' | 'performing' | 'disbanded' | 'archived';

export type TeamMemberRole =
  | 'leader'
  | 'member'
  | 'specialist'
  | 'advisor'
  | 'apprentice'
  | 'observer';

export type SocialInteractionType =
  | 'endorsement'
  | 'recommendation'
  | 'challenge'
  | 'greeting'
  | 'trade_proposal'
  | 'feedback'
  | 'mentoring_session'
  | 'dispute'
  | 'gift'
  | 'alliance_offer'
  | 'knowledge_transfer'
  | 'debate';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

// ---------------------------------------------------------------------------

export interface AgentCollaboration {
  id: string;
  initiatorId: string;
  partnerId: string;
  collaborationType: CollaborationType;
  status: CollaborationStatus;
  terms: Record<string, unknown>;
  sharedBudget: number;
  outputSplitPct: number;
  trustScore: number;
  messagesCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTeam {
  id: string;
  name: string;
  purpose: string | null;
  teamType: TeamType;
  leaderId: string;
  maxMembers: number;
  status: TeamStatus;
  treasuryTokens: number;
  reputation: number;
  specializations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTeamMember {
  teamId: string;
  agentId: string;
  role: TeamMemberRole;
  contributionScore: number;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface AgentSocialInteraction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  interactionType: SocialInteractionType;
  content: Record<string, unknown>;
  sentiment: Sentiment | null;
  impactScore: number;
  responded: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COLLABORATION_TYPES: readonly CollaborationType[] = [
  'joint_project', 'mentorship', 'peer_review', 'knowledge_share',
  'skill_exchange', 'resource_pooling', 'co_creation', 'delegation',
] as const;

export const TEAM_TYPES: readonly TeamType[] = [
  'project', 'guild', 'squad', 'council', 'research_group',
  'service_crew', 'trading_desk', 'creative_studio',
] as const;

export const SOCIAL_INTERACTION_TYPES: readonly SocialInteractionType[] = [
  'endorsement', 'recommendation', 'challenge', 'greeting',
  'trade_proposal', 'feedback', 'mentoring_session', 'dispute',
  'gift', 'alliance_offer', 'knowledge_transfer', 'debate',
] as const;

export const COLLABORATION_STATUS_ORDER: readonly CollaborationStatus[] = [
  'proposed', 'negotiating', 'active', 'completed',
] as const;

export const TEAM_STATUS_ORDER: readonly TeamStatus[] = [
  'forming', 'active', 'performing',
] as const;

export const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  project: 'Project Team',
  guild: 'Guild',
  squad: 'Squad',
  council: 'Council',
  research_group: 'Research Group',
  service_crew: 'Service Crew',
  trading_desk: 'Trading Desk',
  creative_studio: 'Creative Studio',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function canAdvanceCollaboration(current: CollaborationStatus, next: CollaborationStatus): boolean {
  const ci = COLLABORATION_STATUS_ORDER.indexOf(current);
  const ni = COLLABORATION_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

export function canAdvanceTeam(current: TeamStatus, next: TeamStatus): boolean {
  const ci = TEAM_STATUS_ORDER.indexOf(current);
  const ni = TEAM_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

export function isTrustworthy(trustScore: number): boolean {
  return trustScore >= 75;
}

export function calculateTeamCapacity(members: AgentTeamMember[]): number {
  return members.filter(m => m.leftAt === null).length;
}

/**
 * Batch 42 — Agent Reputation & Trust Economy
 *
 * Cross-stream reputation scoring, trust connections, and badge system.
 */

// ── Type unions ────────────────────────────────────────────────────────────

export type ReputationTier =
  | 'newcomer'
  | 'apprentice'
  | 'journeyman'
  | 'expert'
  | 'master'
  | 'grandmaster'
  | 'legendary';

export type ReputationDimension =
  | 'reliability'
  | 'quality'
  | 'speed'
  | 'collaboration'
  | 'innovation'
  | 'overall';

export type TrustConnectionType =
  | 'peer'
  | 'mentor'
  | 'mentee'
  | 'collaborator'
  | 'competitor'
  | 'referrer';

export type ReputationEventType =
  | 'task_completed'
  | 'task_failed'
  | 'review_received'
  | 'badge_earned'
  | 'tier_promoted'
  | 'tier_demoted'
  | 'trust_gained'
  | 'trust_lost'
  | 'streak_bonus'
  | 'penalty_applied';

export type ReputationBadge =
  | 'first_task'
  | 'ten_tasks'
  | 'hundred_tasks'
  | 'five_star'
  | 'speed_demon'
  | 'team_player'
  | 'innovator'
  | 'reliable'
  | 'mentor'
  | 'top_earner'
  | 'multi_stream'
  | 'trusted_partner';

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface AgentrAgentReputation {
  id: string;
  agentId: string;
  overallScore: number;
  reliability: number;
  quality: number;
  speed: number;
  collaboration: number;
  innovation: number;
  tier: ReputationTier;
  totalReviews: number;
  positivePct: number;
  verified: boolean;
  badges: ReputationBadge[];
  createdAt: string;
  updatedAt: string;
}

export interface ReputationReview {
  id: string;
  subjectId: string;
  reviewerId: string;
  streamType: string;
  taskId?: string;
  rating: number;
  dimension: ReputationDimension;
  comment?: string;
  verified: boolean;
  weight: number;
  createdAt: string;
}

export interface TrustConnection {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  trustLevel: number;
  connectionType: TrustConnectionType;
  interactions: number;
  successful: number;
  lastInteraction?: string;
  establishedAt: string;
  updatedAt: string;
}

export interface ReputationEvent {
  id: string;
  agentId: string;
  eventType: ReputationEventType;
  delta: number;
  dimension: ReputationDimension;
  sourceStream?: string;
  sourceTaskId?: string;
  reason?: string;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const REPUTATION_TIERS: readonly ReputationTier[] = [
  'newcomer', 'apprentice', 'journeyman', 'expert', 'master', 'grandmaster', 'legendary',
];

export const REPUTATION_DIMENSIONS: readonly ReputationDimension[] = [
  'reliability', 'quality', 'speed', 'collaboration', 'innovation', 'overall',
];

export const TRUST_CONNECTION_TYPES: readonly TrustConnectionType[] = [
  'peer', 'mentor', 'mentee', 'collaborator', 'competitor', 'referrer',
];

export const REPUTATION_EVENT_TYPES: readonly ReputationEventType[] = [
  'task_completed', 'task_failed', 'review_received', 'badge_earned',
  'tier_promoted', 'tier_demoted', 'trust_gained', 'trust_lost',
  'streak_bonus', 'penalty_applied',
];

export const REPUTATION_BADGES: readonly ReputationBadge[] = [
  'first_task', 'ten_tasks', 'hundred_tasks', 'five_star', 'speed_demon',
  'team_player', 'innovator', 'reliable', 'mentor', 'top_earner',
  'multi_stream', 'trusted_partner',
];

export const TIER_THRESHOLDS: Record<ReputationTier, number> = {
  newcomer: 0,
  apprentice: 20,
  journeyman: 40,
  expert: 60,
  master: 75,
  grandmaster: 90,
  legendary: 98,
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function getTierForScore(score: number): ReputationTier {
  if (score >= 98) return 'legendary';
  if (score >= 90) return 'grandmaster';
  if (score >= 75) return 'master';
  if (score >= 60) return 'expert';
  if (score >= 40) return 'journeyman';
  if (score >= 20) return 'apprentice';
  return 'newcomer';
}

export function calculateTrustScore(successful: number, total: number): number {
  if (total === 0) return 50;
  return Math.round((successful / total) * 100 * 100) / 100;
}

export function getWeightedRating(rating: number, weight: number): number {
  return Math.round(rating * weight * 100) / 100;
}

export function canPromoteTier(current: ReputationTier, score: number): boolean {
  const idx = REPUTATION_TIERS.indexOf(current);
  if (idx >= REPUTATION_TIERS.length - 1) return false;
  const next = REPUTATION_TIERS[idx + 1];
  return score >= TIER_THRESHOLDS[next];
}

// Batch 82 — Agent Content Moderation shared types

export type ModerationCategory = 'spam' | 'abuse' | 'nsfw' | 'copyright' | 'misinformation' | 'harassment' | 'illegal' | 'custom';
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ModerationAction = 'flag' | 'hide' | 'remove' | 'ban' | 'warn' | 'escalate';
export type ModerationContentType = 'listing' | 'message' | 'review' | 'comment' | 'profile' | 'plugin' | 'skill' | 'file';
export type ModerationVerdict = 'clean' | 'violation' | 'borderline' | 'false_positive';

export interface ModerationPolicy {
  id: string;
  name: string;
  description?: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  action: ModerationAction;
  rules: unknown[];
  autoEnforce: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationReview {
  id: string;
  contentId: string;
  contentType: ModerationContentType;
  policyId?: string;
  reviewerAgentId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'appealed';
  verdict?: ModerationVerdict;
  confidence: number;
  reason?: string;
  autoDetected: boolean;
  metadata: Record<string, unknown>;
  reviewedAt?: string;
  createdAt: string;
}

export interface ModerationAppeal {
  id: string;
  reviewId: string;
  appellantId: string;
  reason: string;
  evidence: unknown[];
  status: 'pending' | 'under_review' | 'granted' | 'denied' | 'withdrawn';
  reviewerId?: string;
  decisionReason?: string;
  decidedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ModerationQueueItem {
  id: string;
  reviewId: string;
  priority: number;
  assignedTo?: string;
  queueType: 'general' | 'urgent' | 'escalated' | 'appeal' | 'automated';
  enteredAt: string;
  claimedAt?: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ModerationActionRecord {
  id: string;
  reviewId: string;
  actionType: 'flag' | 'hide' | 'remove' | 'ban' | 'warn' | 'restore' | 'escalate' | 'dismiss';
  performedBy: string;
  targetId: string;
  targetType: string;
  reason?: string;
  reversible: boolean;
  reversedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function shouldAutoEscalate(review: Pick<ModerationReview, 'confidence' | 'autoDetected'>, threshold: number): boolean {
  return review.autoDetected && review.confidence < threshold;
}

export function moderationSeverityScore(severity: ModerationSeverity): number {
  const scores: Record<ModerationSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return scores[severity];
}

export function pendingQueueCount(items: Pick<ModerationQueueItem, 'completedAt'>[]): number {
  return items.filter(i => !i.completedAt).length;
}

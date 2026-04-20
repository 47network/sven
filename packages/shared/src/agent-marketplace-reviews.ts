// Batch 56 — Agent Marketplace Reviews shared types

/* ------------------------------------------------------------------ */
/*  Type unions                                                        */
/* ------------------------------------------------------------------ */

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'hidden';

export type ResponseType = 'seller' | 'admin' | 'system' | 'follow_up' | 'clarification';

export type ModerationAction = 'approve' | 'reject' | 'flag' | 'hide' | 'escalate' | 'unflag';

export type VoteType = 'helpful' | 'unhelpful' | 'spam' | 'inappropriate' | 'outdated';

export type ReviewSortBy = 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful';

export type SentimentLabel = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export type ReviewAction = 'review_submit' | 'review_respond' | 'review_moderate' | 'review_vote' | 'analytics_generate' | 'review_flag' | 'review_highlight';

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

export interface MarketplaceReview {
  id: string;
  listing_id: string;
  reviewer_id: string;
  seller_id: string;
  rating: number;
  title?: string;
  body?: string;
  pros: string[];
  cons: string[];
  verified: boolean;
  status: ReviewStatus;
  helpful_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewResponse {
  id: string;
  review_id: string;
  responder_id: string;
  body: string;
  response_type: ResponseType;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewModeration {
  id: string;
  review_id: string;
  moderator_id?: string;
  action: ModerationAction;
  reason?: string;
  automated: boolean;
  confidence?: number;
  created_at: string;
}

export interface ReviewVote {
  id: string;
  review_id: string;
  voter_id: string;
  vote_type: VoteType;
  created_at: string;
}

export interface ReviewAnalytics {
  id: string;
  listing_id: string;
  period_start: string;
  period_end: string;
  total_reviews: number;
  average_rating: number;
  rating_dist: Record<string, number>;
  sentiment_score?: number;
  top_pros: string[];
  top_cons: string[];
  response_rate: number;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const REVIEW_STATUSES: readonly ReviewStatus[] = ['pending', 'approved', 'rejected', 'flagged', 'hidden'] as const;

export const RESPONSE_TYPES: readonly ResponseType[] = ['seller', 'admin', 'system', 'follow_up', 'clarification'] as const;

export const MODERATION_ACTIONS: readonly ModerationAction[] = ['approve', 'reject', 'flag', 'hide', 'escalate', 'unflag'] as const;

export const VOTE_TYPES: readonly VoteType[] = ['helpful', 'unhelpful', 'spam', 'inappropriate', 'outdated'] as const;

export const REVIEW_SORT_OPTIONS: readonly ReviewSortBy[] = ['newest', 'oldest', 'highest', 'lowest', 'most_helpful'] as const;

export const SENTIMENT_LABELS: readonly SentimentLabel[] = ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function isReviewVisible(status: ReviewStatus): boolean {
  return status === 'approved';
}

export function isPositiveRating(rating: number): boolean {
  return rating >= 4;
}

export function getSentimentLabel(score: number): SentimentLabel {
  if (score >= 0.6) return 'very_positive';
  if (score >= 0.2) return 'positive';
  if (score >= -0.2) return 'neutral';
  if (score >= -0.6) return 'negative';
  return 'very_negative';
}

export function calculateAverageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
}

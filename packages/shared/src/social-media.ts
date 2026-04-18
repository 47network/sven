// ---------------------------------------------------------------------------
// Social Media Integration — shared types for Batch 25
// ---------------------------------------------------------------------------

// ── Platform Types ──────────────────────────────────────────────────────────

export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'threads';

export type AccountStatus =
  | 'active'
  | 'paused'
  | 'expired'
  | 'revoked'
  | 'pending_setup';

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'deleted'
  | 'archived';

export type SocialContentType =
  | 'image'
  | 'video'
  | 'story'
  | 'reel'
  | 'carousel'
  | 'text'
  | 'live'
  | 'poll';

export type CampaignGoal =
  | 'engagement'
  | 'traffic'
  | 'sales'
  | 'awareness'
  | 'followers'
  | 'leads';

export type CampaignStatus =
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type CalendarEntryStatus =
  | 'planned'
  | 'content_ready'
  | 'scheduled'
  | 'posted'
  | 'skipped'
  | 'rescheduled';

export type ContentCategory =
  | 'promotional'
  | 'educational'
  | 'behind_the_scenes'
  | 'engagement'
  | 'milestone'
  | 'product_launch'
  | 'testimonial'
  | 'seasonal';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  displayName: string;
  followersCount: number;
  status: AccountStatus;
  managedByAgent: string | null;
  tokenExpiresAt: string | null;
  accountMeta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  accountId: string;
  campaignId: string | null;
  contentType: SocialContentType;
  caption: string;
  mediaUrls: string[];
  hashtags: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  status: PostStatus;
  externalId: string | null;
  errorMessage: string | null;
  createdByAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialCampaign {
  id: string;
  name: string;
  description: string;
  goal: CampaignGoal;
  status: CampaignStatus;
  targetPlatforms: SocialPlatform[];
  budgetTokens: number;
  spentTokens: number;
  startDate: string | null;
  endDate: string | null;
  managedByAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAnalyticsEntry {
  id: string;
  postId: string;
  accountId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number;
  audienceData: Record<string, unknown>;
  trackedAt: string;
}

export interface ContentCalendarEntry {
  id: string;
  accountId: string | null;
  campaignId: string | null;
  title: string;
  description: string;
  contentType: SocialContentType;
  plannedDate: string;
  actualPostId: string | null;
  status: CalendarEntryStatus;
  assignedAgent: string | null;
  category: ContentCategory;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const SUPPORTED_PLATFORMS: readonly SocialPlatform[] = [
  'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads',
] as const;

export const POST_STATUS_ORDER: readonly PostStatus[] = [
  'draft', 'scheduled', 'publishing', 'published',
] as const;

export const OPTIMAL_POST_HOURS: Record<SocialPlatform, number[]> = {
  instagram: [9, 12, 17, 20],
  tiktok: [7, 10, 19, 22],
  youtube: [12, 15, 18],
  twitter: [8, 12, 17],
  facebook: [9, 13, 16],
  linkedin: [7, 10, 12],
  threads: [9, 12, 18, 21],
};

export const HASHTAG_LIMITS: Record<SocialPlatform, number> = {
  instagram: 30,
  tiktok: 100,
  youtube: 15,
  twitter: 5,
  facebook: 10,
  linkedin: 5,
  threads: 10,
};

export const CAPTION_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200,
  tiktok: 4000,
  youtube: 5000,
  twitter: 280,
  facebook: 63206,
  linkedin: 3000,
  threads: 500,
};

// ── Utility Functions ───────────────────────────────────────────────────────

export function canPublishPost(post: Pick<SocialPost, 'status' | 'caption' | 'accountId'>): boolean {
  return (post.status === 'draft' || post.status === 'scheduled')
    && post.caption.length > 0
    && post.accountId.length > 0;
}

export function getOptimalPostHours(platform: SocialPlatform): number[] {
  return OPTIMAL_POST_HOURS[platform] ?? [12];
}

export function calculateEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  reach: number,
): number {
  if (reach <= 0) return 0;
  return Number((((likes + comments + shares + saves) / reach) * 100).toFixed(4));
}

export function isWithinHashtagLimit(platform: SocialPlatform, count: number): boolean {
  return count <= (HASHTAG_LIMITS[platform] ?? 30);
}

export function isWithinCaptionLimit(platform: SocialPlatform, caption: string): boolean {
  return caption.length <= (CAPTION_LIMITS[platform] ?? 2200);
}

export function formatHashtags(tags: string[]): string[] {
  return tags.map((tag) => {
    const clean = tag.replace(/[^a-zA-Z0-9_]/g, '');
    return clean.startsWith('#') ? clean : `#${clean}`;
  });
}

// ---------------------------------------------------------------------------
// Batch 25 — Social Media Integration tests
// ---------------------------------------------------------------------------
// Validates: migration SQL, shared types, admin API, admin wiring,
// NATS/Eidolon events, skills, task executor handlers.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ─── Migration SQL ──────────────────────────────────────────────────────────

describe('Batch 25 — Migration: social_media', () => {
  const sql = readFile('services/gateway-api/migrations/20260429120000_social_media.sql');

  it('creates social_accounts table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS social_accounts');
  });

  it('creates social_posts table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS social_posts');
  });

  it('creates social_campaigns table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS social_campaigns');
  });

  it('creates social_analytics table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS social_analytics');
  });

  it('creates content_calendar table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS content_calendar');
  });

  // social_accounts columns
  it('social_accounts has platform column with CHECK', () => {
    expect(sql).toContain("platform        TEXT NOT NULL CHECK (platform IN (");
    expect(sql).toContain("'instagram'");
    expect(sql).toContain("'tiktok'");
    expect(sql).toContain("'youtube'");
    expect(sql).toContain("'twitter'");
    expect(sql).toContain("'facebook'");
    expect(sql).toContain("'linkedin'");
    expect(sql).toContain("'threads'");
  });

  it('social_accounts has account_name column', () => {
    expect(sql).toContain('account_name    TEXT NOT NULL');
  });

  it('social_accounts has access_token column', () => {
    expect(sql).toContain('access_token    TEXT NOT NULL');
  });

  it('social_accounts has status CHECK', () => {
    expect(sql).toContain("'active', 'paused', 'expired', 'revoked', 'pending_setup'");
  });

  it('social_accounts has managed_by_agent column', () => {
    expect(sql).toContain('managed_by_agent TEXT');
  });

  it('social_accounts has followers_count column', () => {
    expect(sql).toContain('followers_count INTEGER NOT NULL DEFAULT 0');
  });

  // social_posts columns
  it('social_posts has content_type CHECK', () => {
    expect(sql).toContain("'image', 'video', 'story', 'reel', 'carousel', 'text', 'live', 'poll'");
  });

  it('social_posts has caption column', () => {
    expect(sql).toContain('caption         TEXT NOT NULL');
  });

  it('social_posts has media_urls JSONB', () => {
    expect(sql).toContain("media_urls      JSONB NOT NULL DEFAULT '[]'");
  });

  it('social_posts has hashtags JSONB', () => {
    expect(sql).toContain("hashtags        JSONB NOT NULL DEFAULT '[]'");
  });

  it('social_posts has status CHECK', () => {
    expect(sql).toContain("'draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted', 'archived'");
  });

  it('social_posts references social_accounts', () => {
    expect(sql).toContain('REFERENCES social_accounts(id)');
  });

  // social_campaigns columns
  it('social_campaigns has goal CHECK', () => {
    expect(sql).toContain("'engagement', 'traffic', 'sales', 'awareness', 'followers', 'leads'");
  });

  it('social_campaigns has status CHECK', () => {
    expect(sql).toContain("'planning', 'active', 'paused', 'completed', 'cancelled'");
  });

  it('social_campaigns has budget_tokens column', () => {
    expect(sql).toContain('budget_tokens   NUMERIC(18,6)');
  });

  it('social_campaigns has target_platforms JSONB', () => {
    expect(sql).toContain("target_platforms JSONB NOT NULL DEFAULT '[]'");
  });

  // social_analytics columns
  it('social_analytics has impressions column', () => {
    expect(sql).toContain('impressions     INTEGER NOT NULL DEFAULT 0');
  });

  it('social_analytics has reach column', () => {
    expect(sql).toContain('reach           INTEGER NOT NULL DEFAULT 0');
  });

  it('social_analytics has engagement_rate column', () => {
    expect(sql).toContain('engagement_rate NUMERIC(8,4)');
  });

  it('social_analytics references social_posts', () => {
    expect(sql).toContain('REFERENCES social_posts(id)');
  });

  // content_calendar columns
  it('content_calendar has planned_date column', () => {
    expect(sql).toContain('planned_date    TIMESTAMPTZ NOT NULL');
  });

  it('content_calendar has category CHECK', () => {
    expect(sql).toContain("'promotional', 'educational', 'behind_the_scenes', 'engagement', 'milestone'");
  });

  it('content_calendar has status CHECK', () => {
    expect(sql).toContain("'planned', 'content_ready', 'scheduled', 'posted', 'skipped', 'rescheduled'");
  });

  it('content_calendar references social_campaigns', () => {
    expect(sql).toContain('REFERENCES social_campaigns(id)');
  });

  // Indexes
  it('creates at least 15 indexes', () => {
    const indexCount = (sql.match(/CREATE INDEX/g) || []).length;
    expect(indexCount).toBeGreaterThanOrEqual(15);
  });

  // ALTER marketplace_tasks
  it('alters marketplace_tasks CHECK to include social_post', () => {
    expect(sql).toContain("'social_post'");
  });

  it('alters marketplace_tasks CHECK to include social_analytics', () => {
    expect(sql).toContain("'social_analytics'");
  });

  it('is wrapped in BEGIN/COMMIT', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });
});

// ─── Shared Types ───────────────────────────────────────────────────────────

describe('Batch 25 — Shared Types: social-media.ts', () => {
  const src = readFile('packages/shared/src/social-media.ts');

  it('exports SocialPlatform type', () => {
    expect(src).toContain("export type SocialPlatform =");
  });

  it('SocialPlatform includes all 7 platforms', () => {
    for (const p of ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads']) {
      expect(src).toContain(`'${p}'`);
    }
  });

  it('exports AccountStatus type', () => {
    expect(src).toContain("export type AccountStatus =");
    for (const s of ['active', 'paused', 'expired', 'revoked', 'pending_setup']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports PostStatus type with 7 values', () => {
    expect(src).toContain("export type PostStatus =");
    for (const s of ['draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted', 'archived']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports SocialContentType with 8 values', () => {
    expect(src).toContain("export type SocialContentType =");
    for (const t of ['image', 'video', 'story', 'reel', 'carousel', 'text', 'live', 'poll']) {
      expect(src).toContain(`'${t}'`);
    }
  });

  it('exports CampaignGoal type', () => {
    expect(src).toContain("export type CampaignGoal =");
    for (const g of ['engagement', 'traffic', 'sales', 'awareness', 'followers', 'leads']) {
      expect(src).toContain(`'${g}'`);
    }
  });

  it('exports CampaignStatus type', () => {
    expect(src).toContain("export type CampaignStatus =");
    for (const s of ['planning', 'active', 'paused', 'completed', 'cancelled']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports CalendarEntryStatus type', () => {
    expect(src).toContain("export type CalendarEntryStatus =");
    for (const s of ['planned', 'content_ready', 'scheduled', 'posted', 'skipped', 'rescheduled']) {
      expect(src).toContain(`'${s}'`);
    }
  });

  it('exports ContentCategory type', () => {
    expect(src).toContain("export type ContentCategory =");
    for (const c of ['promotional', 'educational', 'behind_the_scenes', 'engagement', 'milestone',
      'product_launch', 'testimonial', 'seasonal']) {
      expect(src).toContain(`'${c}'`);
    }
  });

  it('exports 5 interfaces', () => {
    expect(src).toContain('export interface SocialAccount');
    expect(src).toContain('export interface SocialPost');
    expect(src).toContain('export interface SocialCampaign');
    expect(src).toContain('export interface SocialAnalyticsEntry');
    expect(src).toContain('export interface ContentCalendarEntry');
  });

  it('exports SUPPORTED_PLATFORMS constant with 7 platforms', () => {
    expect(src).toContain('export const SUPPORTED_PLATFORMS');
    expect(src).toContain("'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads'");
  });

  it('exports POST_STATUS_ORDER constant', () => {
    expect(src).toContain('export const POST_STATUS_ORDER');
  });

  it('exports OPTIMAL_POST_HOURS for all platforms', () => {
    expect(src).toContain('export const OPTIMAL_POST_HOURS');
    expect(src).toContain('instagram: [9, 12, 17, 20]');
    expect(src).toContain('tiktok: [7, 10, 19, 22]');
  });

  it('exports HASHTAG_LIMITS', () => {
    expect(src).toContain('export const HASHTAG_LIMITS');
    expect(src).toContain('instagram: 30');
    expect(src).toContain('twitter: 5');
  });

  it('exports CAPTION_LIMITS', () => {
    expect(src).toContain('export const CAPTION_LIMITS');
    expect(src).toContain('instagram: 2200');
    expect(src).toContain('twitter: 280');
  });

  it('exports canPublishPost utility function', () => {
    expect(src).toContain('export function canPublishPost');
  });

  it('exports getOptimalPostHours utility function', () => {
    expect(src).toContain('export function getOptimalPostHours');
  });

  it('exports calculateEngagementRate utility function', () => {
    expect(src).toContain('export function calculateEngagementRate');
  });

  it('exports isWithinHashtagLimit utility function', () => {
    expect(src).toContain('export function isWithinHashtagLimit');
  });

  it('exports isWithinCaptionLimit utility function', () => {
    expect(src).toContain('export function isWithinCaptionLimit');
  });

  it('exports formatHashtags utility function', () => {
    expect(src).toContain('export function formatHashtags');
  });

  it('is exported from packages/shared/src/index.ts', () => {
    const idx = readFile('packages/shared/src/index.ts');
    expect(idx).toContain("'./social-media.js'");
  });
});

// ─── Admin API ──────────────────────────────────────────────────────────────

describe('Batch 25 — Admin API: social-media.ts', () => {
  const src = readFile('services/gateway-api/src/routes/admin/social-media.ts');

  it('exports registerSocialMediaRoutes function', () => {
    expect(src).toContain('export function registerSocialMediaRoutes');
  });

  it('accepts FastifyInstance, Pool, and optional NatsConnection', () => {
    expect(src).toContain('app: FastifyInstance, pool: pg.Pool, nc?: NatsConnection');
  });

  // Social accounts routes
  it('has GET /social/accounts route', () => {
    expect(src).toContain("app.get('/social/accounts'");
  });

  it('has GET /social/accounts/:accountId route', () => {
    expect(src).toContain("app.get<{ Params: { accountId: string } }>('/social/accounts/:accountId'");
  });

  it('has POST /social/accounts route', () => {
    expect(src).toContain("app.post('/social/accounts'");
  });

  it('has PATCH /social/accounts/:accountId route', () => {
    expect(src).toContain("app.patch<{ Params: { accountId: string } }>('/social/accounts/:accountId'");
  });

  it('has DELETE /social/accounts/:accountId route', () => {
    expect(src).toContain("app.delete<{ Params: { accountId: string } }>('/social/accounts/:accountId'");
  });

  // Social posts routes
  it('has GET /social/posts route', () => {
    expect(src).toContain("app.get('/social/posts'");
  });

  it('has GET /social/posts/:postId route', () => {
    expect(src).toContain("app.get<{ Params: { postId: string } }>('/social/posts/:postId'");
  });

  it('has POST /social/posts route', () => {
    expect(src).toContain("app.post('/social/posts'");
  });

  it('has PATCH /social/posts/:postId route', () => {
    expect(src).toContain("app.patch<{ Params: { postId: string } }>('/social/posts/:postId'");
  });

  it('has POST /social/posts/:postId/publish route', () => {
    expect(src).toContain("app.post<{ Params: { postId: string } }>('/social/posts/:postId/publish'");
  });

  it('has DELETE /social/posts/:postId route', () => {
    expect(src).toContain("app.delete<{ Params: { postId: string } }>('/social/posts/:postId'");
  });

  // Social campaigns routes
  it('has GET /social/campaigns route', () => {
    expect(src).toContain("app.get('/social/campaigns'");
  });

  it('has GET /social/campaigns/:campaignId route', () => {
    expect(src).toContain("app.get<{ Params: { campaignId: string } }>('/social/campaigns/:campaignId'");
  });

  it('has POST /social/campaigns route', () => {
    expect(src).toContain("app.post('/social/campaigns'");
  });

  it('has PATCH /social/campaigns/:campaignId route', () => {
    expect(src).toContain("app.patch<{ Params: { campaignId: string } }>('/social/campaigns/:campaignId'");
  });

  // Analytics routes
  it('has GET /social/posts/:postId/analytics route', () => {
    expect(src).toContain("app.get<{ Params: { postId: string } }>('/social/posts/:postId/analytics'");
  });

  it('has POST /social/posts/:postId/analytics route', () => {
    expect(src).toContain("app.post<{ Params: { postId: string } }>('/social/posts/:postId/analytics'");
  });

  it('has GET /social/analytics/overview route', () => {
    expect(src).toContain("app.get('/social/analytics/overview'");
  });

  // Content calendar routes
  it('has GET /social/calendar route', () => {
    expect(src).toContain("app.get('/social/calendar'");
  });

  it('has POST /social/calendar route', () => {
    expect(src).toContain("app.post('/social/calendar'");
  });

  it('has PATCH /social/calendar/:entryId route', () => {
    expect(src).toContain("app.patch<{ Params: { entryId: string } }>('/social/calendar/:entryId'");
  });

  it('has DELETE /social/calendar/:entryId route', () => {
    expect(src).toContain("app.delete<{ Params: { entryId: string } }>('/social/calendar/:entryId'");
  });

  it('has at least 22 route handlers', () => {
    const routeCount = (src.match(/app\.(get|post|patch|delete)/g) || []).length;
    expect(routeCount).toBeGreaterThanOrEqual(22);
  });

  // NATS publishing
  it('publishes sven.social.account_connected event', () => {
    expect(src).toContain("'sven.social.account_connected'");
  });

  it('publishes sven.social.post_created event', () => {
    expect(src).toContain("'sven.social.post_created'");
  });

  it('publishes sven.social.post_published event', () => {
    expect(src).toContain("'sven.social.post_published'");
  });

  it('publishes sven.social.campaign_started event', () => {
    expect(src).toContain("'sven.social.campaign_started'");
  });

  it('publishes sven.social.engagement_milestone event', () => {
    expect(src).toContain("'sven.social.engagement_milestone'");
  });
});

// ─── Admin Wiring ───────────────────────────────────────────────────────────

describe('Batch 25 — Admin Wiring', () => {
  const idx = readFile('services/gateway-api/src/routes/admin/index.ts');

  it('imports registerSocialMediaRoutes', () => {
    expect(idx).toContain("import { registerSocialMediaRoutes } from './social-media.js'");
  });

  it('mounts registerSocialMediaRoutes via mountAdminRoutes', () => {
    expect(idx).toContain('registerSocialMediaRoutes(scopedApp, pool, nc)');
  });
});

// ─── NATS / Eidolon Events ──────────────────────────────────────────────────

describe('Batch 25 — NATS/Eidolon Events', () => {
  const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');
  const types = readFile('services/sven-eidolon/src/types.ts');

  it('SUBJECT_MAP has sven.social.account_connected', () => {
    expect(eventBus).toContain("'sven.social.account_connected': 'social.account_connected'");
  });

  it('SUBJECT_MAP has sven.social.post_created', () => {
    expect(eventBus).toContain("'sven.social.post_created': 'social.post_created'");
  });

  it('SUBJECT_MAP has sven.social.post_published', () => {
    expect(eventBus).toContain("'sven.social.post_published': 'social.post_published'");
  });

  it('SUBJECT_MAP has sven.social.campaign_started', () => {
    expect(eventBus).toContain("'sven.social.campaign_started': 'social.campaign_started'");
  });

  it('SUBJECT_MAP has sven.social.engagement_milestone', () => {
    expect(eventBus).toContain("'sven.social.engagement_milestone': 'social.engagement_milestone'");
  });

  it('SUBJECT_MAP has at least 50 entries', () => {
    const subjectCount = (eventBus.match(/'sven\./g) || []).length;
    expect(subjectCount).toBeGreaterThanOrEqual(50);
  });

  it('EidolonEventKind includes social.account_connected', () => {
    expect(types).toContain("'social.account_connected'");
  });

  it('EidolonEventKind includes social.post_created', () => {
    expect(types).toContain("'social.post_created'");
  });

  it('EidolonEventKind includes social.post_published', () => {
    expect(types).toContain("'social.post_published'");
  });

  it('EidolonEventKind includes social.campaign_started', () => {
    expect(types).toContain("'social.campaign_started'");
  });

  it('EidolonEventKind includes social.engagement_milestone', () => {
    expect(types).toContain("'social.engagement_milestone'");
  });

  it('EidolonBuildingKind includes media_studio', () => {
    expect(types).toContain("'media_studio'");
  });

  it('districtFor handles media_studio', () => {
    expect(types).toContain("case 'media_studio':");
  });

  it('EidolonBuildingKind has at least 10 values', () => {
    const pipeCount = types.split('EidolonBuildingKind')[1]?.split(';')[0]?.match(/\|/g)?.length ?? 0;
    expect(pipeCount).toBeGreaterThanOrEqual(10);
  });
});

// ─── Skills ─────────────────────────────────────────────────────────────────

describe('Batch 25 — Skill: social-media-post', () => {
  const skill = readFile('skills/autonomous-economy/social-media-post/SKILL.md');

  it('has YAML frontmatter with name', () => {
    expect(skill).toContain('name: social-media-post');
  });

  it('has version 1.0.0', () => {
    expect(skill).toContain('version: 1.0.0');
  });

  it('has pricing at 1.99 per post', () => {
    expect(skill).toContain('basePrice: 1.99');
  });

  it('uses marketer archetype', () => {
    expect(skill).toContain('archetype: marketer');
  });

  it('lists all 7 platforms', () => {
    for (const p of ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads']) {
      expect(skill).toContain(`- ${p}`);
    }
  });

  it('describes create-post action', () => {
    expect(skill).toContain('### create-post');
  });

  it('describes schedule-post action', () => {
    expect(skill).toContain('### schedule-post');
  });

  it('describes multi-platform action', () => {
    expect(skill).toContain('### multi-platform');
  });

  it('describes generate-content-calendar action', () => {
    expect(skill).toContain('### generate-content-calendar');
  });

  it('includes platform limits reference table', () => {
    expect(skill).toContain('| Platform  | Hashtags | Caption Length');
  });
});

describe('Batch 25 — Skill: social-analytics', () => {
  const skill = readFile('skills/autonomous-economy/social-analytics/SKILL.md');

  it('has YAML frontmatter with name', () => {
    expect(skill).toContain('name: social-analytics');
  });

  it('has version 1.0.0', () => {
    expect(skill).toContain('version: 1.0.0');
  });

  it('has pricing at 0.99 per analysis', () => {
    expect(skill).toContain('basePrice: 0.99');
  });

  it('uses analyst archetype', () => {
    expect(skill).toContain('archetype: analyst');
  });

  it('describes track-engagement action', () => {
    expect(skill).toContain('### track-engagement');
  });

  it('describes analyze-campaign action', () => {
    expect(skill).toContain('### analyze-campaign');
  });

  it('describes audience-insights action', () => {
    expect(skill).toContain('### audience-insights');
  });

  it('describes content-ranking action', () => {
    expect(skill).toContain('### content-ranking');
  });

  it('describes roi-report action', () => {
    expect(skill).toContain('### roi-report');
  });

  it('includes performance benchmarks table', () => {
    expect(skill).toContain('| Platform  | Avg Engagement Rate');
  });
});

// ─── Task Executor ──────────────────────────────────────────────────────────

describe('Batch 25 — Task Executor Handlers', () => {
  const src = readFile('services/sven-marketplace/src/task-executor.ts');

  it('has social_post case in routeToHandler', () => {
    expect(src).toContain("case 'social_post':");
  });

  it('has social_analytics case in routeToHandler', () => {
    expect(src).toContain("case 'social_analytics':");
  });

  it('routes social_post to handleSocialPost', () => {
    expect(src).toContain('this.handleSocialPost(input)');
  });

  it('routes social_analytics to handleSocialAnalytics', () => {
    expect(src).toContain('this.handleSocialAnalytics(input)');
  });

  it('handleSocialPost is a private async method', () => {
    expect(src).toContain('private async handleSocialPost');
  });

  it('handleSocialAnalytics is a private async method', () => {
    expect(src).toContain('private async handleSocialAnalytics');
  });

  it('handleSocialPost uses platform-specific caption limits', () => {
    expect(src).toContain('instagram: 2200');
    expect(src).toContain('twitter: 280');
  });

  it('handleSocialPost uses platform-specific hashtag limits', () => {
    expect(src).toContain('instagram: 30');
    expect(src).toContain('twitter: 5');
  });

  it('handleSocialPost generates platform tips', () => {
    expect(src).toContain('platformTips');
  });

  it('handleSocialAnalytics returns recommendations', () => {
    expect(src).toContain('Post consistently during optimal hours');
  });

  it('has at least 18 case handlers total', () => {
    const caseCount = (src.match(/case '/g) || []).length;
    expect(caseCount).toBeGreaterThanOrEqual(18);
  });
});

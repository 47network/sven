# Marketing & Social Media Agents Specification

> Sven agents that manage 47Network's social media presence across Instagram and future platforms.
> Content creation, scheduling, brand voice management, and cross-product marketing.
> Created: 2026-04-09

---

## Overview

The Marketing Agents are Sven-native agents that autonomously manage social media
presence for 47Network and its products. They create visual content, write copy,
schedule posts, maintain brand consistency, and track engagement — all through the
existing agent-runtime with human approval gates.

**Managed accounts:**
- **@47network** — Main 47Network brand (company-level content)
- **@meetsven** — Sven personal assistant (product-specific, personality-driven)
- Future: **@47comms**, **@47housing**, **@cutur**, **@passvault**, **@plate** (per-product when ready)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         agent-runtime                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Content       │  │ Visual       │  │ Engagement             │ │
│  │ Strategy      │  │ Creator      │  │ Monitor                │ │
│  │ Agent         │  │ Agent        │  │ Agent                  │ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────────┘ │
│         │                  │                    │                 │
│         └────────┬─────────┴────────────────────┘                │
│                  │                                                │
│           ┌──────▼──────┐  ┌──────────────┐  ┌───────────────┐  │
│           │ Social Post  │  │ Image Gen    │  │ Brand Voice   │  │
│           │ Skill        │  │ Skill        │  │ Validator     │  │
│           └──────┬──────┘  └──────────────┘  └───────────────┘  │
└──────────────────┼───────────────────────────────────────────────┘
                   │
          ┌────────▼────────┐
          │  egress-proxy    │ (allowlisted: graph.instagram.com,
          │                  │  graph.facebook.com, api.buffer.com)
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │ Instagram / Meta │
          │ Graph API        │
          └─────────────────┘
```

---

## Agent Definitions

### 1. Content Strategy Agent

**Purpose:** Plan, schedule, and orchestrate all social media content across accounts.

**Triggers:**
- Scheduled: weekly content calendar generation (Mondays 08:00 UTC)
- Event-driven: `sven.event.release.*` — new product release → announcement posts
- Event-driven: `sven.event.blog.published` — new blog post → social promotion
- Event-driven: `sven.event.website.deployed` — website update → social mention
- Manual: Account 47 instructs specific content

**Responsibilities:**
- Generate weekly content calendar per account (topics, formats, timing)
- Map product milestones → marketing moments (releases, features, blog posts)
- Coordinate cross-account messaging (47Network announces, Sven comments, etc.)
- Maintain posting frequency cadence (avoid flooding, ensure consistency)
- Track content themes and rotate topics (technical, behind-scenes, community, product)
- Seasonal and trend-aware content suggestions
- A/B content variations for engagement testing
- Ensure bilingual content (EN + RO) where appropriate

**Content Calendar Structure:**
```typescript
interface ContentCalendarEntry {
  id: string;
  account: '47network' | 'meetsven' | string;
  scheduled_at: Date;           // UTC, converted to local for posting
  content_type: 'image' | 'carousel' | 'reel' | 'story';
  topic: string;
  caption_draft: string;
  hashtags: string[];
  visual_brief: string;         // Instructions for Visual Creator Agent
  language: 'en' | 'ro' | 'both';
  status: 'planned' | 'content_ready' | 'approved' | 'posted' | 'failed';
  engagement_goal: string;      // What we hope this post achieves
  approved_by?: string;         // Account 47 approval
  cross_post_refs?: string[];   // Related posts on other accounts
}
```

### 2. Visual Creator Agent

**Purpose:** Generate branded visual content for social media posts.

**Triggers:**
- On-demand: Content Strategy Agent requests visuals for scheduled posts
- Manual: Account 47 requests specific visual

**Responsibilities:**
- Generate images using the `image-generation` skill (existing Sven capability)
- Apply brand guidelines: color palette, typography, logo placement, style consistency
- Create multiple format variants:
  - Instagram feed: 1080×1080 (square), 1080×1350 (portrait)
  - Instagram Story/Reel: 1080×1920 (9:16)
  - Carousel: multiple slides, consistent style
- Compose text overlays with proper typography
- Apply 47Network brand elements (the 47 cosmic/network logo, gradient palette)
- Generate alt text for all images (accessibility)
- Create visual variations for A/B testing
- Maintain visual consistency across all accounts

**Brand Design System:**

```yaml
47network_brand:
  primary_colors:
    cosmic_purple: "#7B2FBE"
    deep_blue: "#1A1A4E"
    network_pink: "#E91E8C"
    accent_cyan: "#00D4FF"
  gradients:
    primary: "linear-gradient(135deg, #7B2FBE, #E91E8C)"
    cosmic: "linear-gradient(180deg, #1A1A4E, #7B2FBE, #E91E8C)"
  typography:
    heading: "Inter Bold"
    body: "Inter Regular"
    code: "JetBrains Mono"
  logo:
    primary: "47-cosmic-circle"  # The circular network/cosmic 47 logo
    variants: ["light", "dark", "monochrome", "icon-only"]
    clear_space: "2x logo height on all sides"
  style:
    aesthetic: "cosmic technology — network nodes, gradients, clean modern"
    tone: "professional yet approachable, technical but not intimidating"
    avoid: "stock photo look, clip art, generic tech imagery"

sven_brand:
  extends: 47network_brand
  personality: "friendly, intelligent, personal"
  avatar: "Sven character"
  tone: "first person, conversational, educational"
```

### 3. Engagement Monitor Agent

**Purpose:** Track post performance, audience growth, and derive insights for content optimization.

**Triggers:**
- Scheduled: hourly engagement check for recent posts
- Scheduled: daily engagement summary (22:00 UTC)
- Scheduled: weekly analytics report (Sundays 20:00 UTC)

**Responsibilities:**
- Track per-post metrics: likes, comments, shares, saves, reach, impressions
- Monitor follower growth trends across all accounts
- Identify top-performing content types and topics
- Analyze optimal posting times for the audience
- Monitor comments for questions, feedback, sentiment
- Flag negative sentiment or issues for Account 47 attention
- Generate weekly analytics report with actionable insights
- Feed engagement data back to Content Strategy Agent for optimization
- Monitor competitor/industry trends (public data only)

**Metrics tracked:**
```typescript
interface PostMetrics {
  post_id: string;
  account: string;
  posted_at: Date;
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    reach: number;
    impressions: number;
    engagement_rate: number;        // (likes + comments + shares + saves) / reach
    profile_visits: number;
    website_clicks: number;
  };
  audience: {
    follower_count: number;
    follower_delta: number;         // Change since last check
    demographics?: object;          // Age, location, active hours (from API insights)
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    flagged_comments: string[];
  };
  collected_at: Date;
}
```

---

## Social Media Skills

### Social Post Skill

```yaml
name: social-post
version: 1.0.0
description: Publish content to Instagram via Meta Graph API
trust_level: trusted
requires_approval: true
approval_scope: admin

permissions:
  - social.instagram.publish
  - social.instagram.read_insights

parameters:
  - name: account
    type: string
    required: true
    description: Target Instagram account handle
  - name: content_type
    type: string
    required: true
    allowed_values: ["image", "carousel", "reel", "story"]
  - name: media_urls
    type: array
    required: true
    description: CDN URLs of media to post
  - name: caption
    type: string
    required: true
    max_length: 2200
  - name: hashtags
    type: array
    max_items: 30
  - name: schedule_at
    type: datetime
    description: ISO 8601 UTC timestamp for scheduled posting
  - name: alt_text
    type: string
    description: Accessibility alt text for images

secrets:
  - INSTAGRAM_47NETWORK_ACCESS_TOKEN
  - INSTAGRAM_MEETSVEN_ACCESS_TOKEN
  - META_APP_ID
  - META_APP_SECRET
```

### Image Generation Skill (Extended)

The existing `image-generation` skill is extended with social media presets:

```yaml
name: image-generation
version: 2.0.0  # Extended from existing
extensions:
  social_presets:
    instagram_feed_square:
      width: 1080
      height: 1080
    instagram_feed_portrait:
      width: 1080
      height: 1350
    instagram_story:
      width: 1080
      height: 1920
    instagram_carousel:
      width: 1080
      height: 1080
      max_slides: 10
  brand_overlays:
    logo_position: ["top-left", "top-right", "bottom-left", "bottom-right", "center"]
    watermark: true
    text_overlay: true
```

---

## Content Approval Workflow

```
 ┌─────────────────┐
 │ Content Strategy │
 │ Agent generates  │
 │ calendar entry   │
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Visual Creator   │
 │ Agent generates  │
 │ image + caption  │
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Brand Voice      │
 │ Validator checks │──── reject → back to Visual Creator
 │ consistency      │
 └────────┬────────┘
          │ pass
          ▼
 ┌─────────────────┐
 │ Account 47       │
 │ reviews preview  │──── reject/edit → back to Content Strategy
 │ approves post    │
 └────────┬────────┘
          │ approved
          ▼
 ┌─────────────────┐
 │ Social Post      │
 │ Skill publishes  │
 │ or schedules     │
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ Engagement       │
 │ Monitor tracks   │
 │ performance      │
 └─────────────────┘
```

**Key rule:** No post goes live without Account 47 approval. The agents create,
optimize, and prepare — but the human makes the final call.

---

## Account Strategy

### @47network (Company Account)

**Voice:** Professional, visionary, technical excellence.
**Content mix:**
- 30% Product announcements and updates
- 25% Technical deep-dives and architecture insights
- 20% Behind-the-scenes (development process, decisions)
- 15% Community and open-source contributions
- 10% Industry commentary and thought leadership

**Posting cadence:** 3-4 posts/week, 2-3 stories/week

### @meetsven (Product Account)

**Voice:** First person (as Sven), friendly, educational, personality-driven.
**Content mix:**
- 35% Feature demonstrations and tutorials
- 25% "Day in the life of an AI" — Sven's perspective on tasks
- 20% Tips and workflows (how to get the most from Sven)
- 10% Community highlights and user stories
- 10% Fun/personality content (Sven's opinions, interests)

**Posting cadence:** 4-5 posts/week, 3-5 stories/week

### Future Product Accounts

Each product gets a dedicated account when it reaches public availability:
- Follow the parent @47network brand design system
- Product-specific color accent within the brand palette
- Managed by the same agent trio (Content Strategy, Visual Creator, Engagement Monitor)
- Cross-promotion with @47network and @meetsven

---

## Instagram API Integration

### Meta Graph API Setup

```typescript
// Required API permissions (Instagram Business Account via Meta for Business)
const REQUIRED_PERMISSIONS = [
  'instagram_basic',              // Read profile info
  'instagram_content_publish',    // Create and publish posts
  'instagram_manage_comments',    // Read and respond to comments
  'instagram_manage_insights',    // Read engagement analytics
  'pages_read_engagement',        // Read page engagement
  'pages_show_list',              // List connected pages
];

// Rate limits respected
const RATE_LIMITS = {
  content_publishing: {
    per_day: 25,                  // Instagram limit: 25 posts/day per account
    per_hour: 10,                 // Self-imposed: avoid spam detection
  },
  api_calls: {
    per_hour: 200,                // Meta Graph API rate limit
  },
  insights: {
    per_day: 100,                 // Insights API calls
  },
};
```

### Token Management

- Long-lived access tokens stored in SOPS-encrypted secrets
- Token refresh automated via a scheduled NATS job (tokens expire every 60 days)
- Token rotation does not require redeployment — skill-runner hot-reloads secrets
- Token scopes follow least-privilege: each account token has only needed permissions
- All token operations logged in audit trail

---

## NATS Subject Map

| Subject | Publisher | Subscriber | Purpose |
|---------|-----------|-----------|---------|
| `sven.agent.marketing.calendar-generate` | Scheduler | Content Strategy Agent | Weekly calendar generation |
| `sven.agent.marketing.create-visual` | Content Strategy Agent | Visual Creator Agent | Request visual creation |
| `sven.agent.marketing.engagement-check` | Scheduler | Engagement Monitor Agent | Check post metrics |
| `sven.tool.execute.social-post` | Content Strategy Agent | skill-runner | Publish to Instagram |
| `sven.tool.execute.image-generation` | Visual Creator Agent | skill-runner | Generate images |
| `sven.event.marketing.post-published` | Social Post Skill | All marketing agents | Post went live |
| `sven.event.marketing.engagement-report` | Engagement Monitor | admin-ui / Account 47 | Analytics report |
| `sven.event.marketing.approval-needed` | Content Strategy Agent | Account 47 | Post ready for review |
| `sven.event.marketing.negative-sentiment` | Engagement Monitor | Account 47 | Negative comment alert |

---

## Database Schema Additions

```sql
-- Social media accounts managed by marketing agents
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'tiktok')),
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('company', 'product', 'persona')),
  product_ref TEXT,              -- Links to a 47Network product if product type
  api_token_ref TEXT NOT NULL,   -- SOPS secret reference (never stored in DB)
  follower_count INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'setup')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, handle)
);

-- Content calendar entries
CREATE TABLE social_content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES social_accounts(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'carousel', 'reel', 'story')),
  topic TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  language TEXT NOT NULL DEFAULT 'en',
  visual_brief TEXT,
  media_urls TEXT[],             -- CDN URLs after image generation
  alt_text TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('planned', 'content_ready', 'approved', 'posted', 'failed', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  platform_post_id TEXT,         -- Instagram post ID after publishing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post engagement metrics (time-series)
CREATE TABLE social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_entry_id UUID NOT NULL REFERENCES social_content_calendar(id),
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  profile_visits INTEGER NOT NULL DEFAULT 0,
  website_clicks INTEGER NOT NULL DEFAULT 0,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weekly analytics reports
CREATE TABLE social_analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES social_accounts(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary JSONB NOT NULL,
  top_posts JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_social_calendar_account ON social_content_calendar(account_id, scheduled_at);
CREATE INDEX idx_social_calendar_status ON social_content_calendar(status);
CREATE INDEX idx_social_metrics_entry ON social_post_metrics(calendar_entry_id, collected_at DESC);
CREATE INDEX idx_social_reports_account ON social_analytics_reports(account_id, period_start DESC);
```

---

## Privacy & Compliance

- **No personal data collection:** Marketing agents analyze aggregate metrics only.
  No tracking of individual Instagram users beyond public engagement data.
- **Meta API compliance:** All API usage follows Meta Platform Terms and Instagram
  API Terms of Use. No scraping, no unauthorized data access.
- **Content moderation:** All generated content passes through Brand Voice Validator
  before approval. No controversial, political, or potentially offensive content.
- **GDPR considerations:** If comments contain personal data, engagement monitor
  processes sentiment only — does not store raw comment text beyond operational need.
- **Influencer/endorsement disclosure:** Any sponsored or partnership content
  clearly labeled per FTC/EU advertising disclosure requirements.
- **Image rights:** All images are generated (not sourced from third parties).
  No copyright-infringing content. 47Network owns all generated visuals.

---

## Hashtag Strategy

```yaml
47network_hashtags:
  always:
    - "#47Network"
    - "#BuildingSomethingGreat"
  rotating:
    - "#OpenSource"
    - "#PrivacyFirst"
    - "#SelfHosted"
    - "#TechStartup"
    - "#NetworkInfrastructure"

sven_hashtags:
  always:
    - "#MeetSven"
    - "#AIAssistant"
    - "#47Network"
  rotating:
    - "#PersonalAI"
    - "#PrivateAI"
    - "#SelfHostedAI"
    - "#AIProductivity"
    - "#OpenSourceAI"

max_hashtags_per_post: 20  # Instagram allows 30, but 20 is optimal
```

---

## Future Extensions

- **Twitter/X integration:** Same agent trio, additional Social Post Skill adapter
- **LinkedIn integration:** Professional content variant for B2B marketing
- **TikTok integration:** Short-form video content using Sven's voice (Piper TTS)
- **Cross-platform scheduling:** Buffer or native scheduling for coordinated launches
- **Influencer collaboration agent:** Identify and manage partnership opportunities
- **UGC (User-Generated Content) curation:** Feature community content with permission
- **Video creation agent:** Short-form product demos, tutorials, behind-the-scenes
- **Email newsletter agent:** Weekly digest from social + blog content
- **Multi-language expansion:** Auto-translate content for RO, DE, FR audiences

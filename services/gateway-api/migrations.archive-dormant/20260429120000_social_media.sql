-- Batch 25 — Social Media Integration
-- Instagram + multi-platform social media management for autonomous marketing

BEGIN;

-- ── Social accounts — connected platform credentials ─────────────────────────
CREATE TABLE IF NOT EXISTS social_accounts (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL CHECK (platform IN (
    'instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads'
  )),
  account_name    TEXT NOT NULL,
  display_name    TEXT NOT NULL DEFAULT '',
  access_token    TEXT NOT NULL DEFAULT '',
  refresh_token   TEXT NOT NULL DEFAULT '',
  token_expires_at TIMESTAMPTZ,
  account_meta    JSONB NOT NULL DEFAULT '{}',
  followers_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'expired', 'revoked', 'pending_setup'
  )),
  managed_by_agent TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_accounts_platform ON social_accounts (platform);
CREATE INDEX idx_social_accounts_status ON social_accounts (status);

-- ── Social posts — content items scheduled or published ──────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES social_accounts(id),
  campaign_id     TEXT,
  content_type    TEXT NOT NULL CHECK (content_type IN (
    'image', 'video', 'story', 'reel', 'carousel', 'text', 'live', 'poll'
  )),
  caption         TEXT NOT NULL DEFAULT '',
  media_urls      JSONB NOT NULL DEFAULT '[]',
  hashtags        JSONB NOT NULL DEFAULT '[]',
  scheduled_at    TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'scheduled', 'publishing', 'published', 'failed', 'deleted', 'archived'
  )),
  external_id     TEXT,
  error_message   TEXT,
  created_by_agent TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_account ON social_posts (account_id);
CREATE INDEX idx_social_posts_campaign ON social_posts (campaign_id);
CREATE INDEX idx_social_posts_status ON social_posts (status);
CREATE INDEX idx_social_posts_scheduled ON social_posts (scheduled_at) WHERE status = 'scheduled';

-- ── Social campaigns — grouped marketing campaigns ───────────────────────────
CREATE TABLE IF NOT EXISTS social_campaigns (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  goal            TEXT NOT NULL DEFAULT 'engagement' CHECK (goal IN (
    'engagement', 'traffic', 'sales', 'awareness', 'followers', 'leads'
  )),
  status          TEXT NOT NULL DEFAULT 'planning' CHECK (status IN (
    'planning', 'active', 'paused', 'completed', 'cancelled'
  )),
  target_platforms JSONB NOT NULL DEFAULT '[]',
  budget_tokens   NUMERIC(18,6) NOT NULL DEFAULT 0,
  spent_tokens    NUMERIC(18,6) NOT NULL DEFAULT 0,
  start_date      TIMESTAMPTZ,
  end_date        TIMESTAMPTZ,
  managed_by_agent TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_campaigns_status ON social_campaigns (status);
CREATE INDEX idx_social_campaigns_goal ON social_campaigns (goal);

-- ── Social analytics — engagement metrics per post ───────────────────────────
CREATE TABLE IF NOT EXISTS social_analytics (
  id              TEXT PRIMARY KEY,
  post_id         TEXT NOT NULL REFERENCES social_posts(id),
  account_id      TEXT NOT NULL REFERENCES social_accounts(id),
  impressions     INTEGER NOT NULL DEFAULT 0,
  reach           INTEGER NOT NULL DEFAULT 0,
  likes           INTEGER NOT NULL DEFAULT 0,
  comments        INTEGER NOT NULL DEFAULT 0,
  shares          INTEGER NOT NULL DEFAULT 0,
  saves           INTEGER NOT NULL DEFAULT 0,
  clicks          INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  audience_data   JSONB NOT NULL DEFAULT '{}',
  tracked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_social_analytics_post ON social_analytics (post_id);
CREATE INDEX idx_social_analytics_account ON social_analytics (account_id);
CREATE INDEX idx_social_analytics_tracked ON social_analytics (tracked_at);

-- ── Content calendar — scheduling and planning entries ───────────────────────
CREATE TABLE IF NOT EXISTS content_calendar (
  id              TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES social_accounts(id),
  campaign_id     TEXT REFERENCES social_campaigns(id),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  content_type    TEXT NOT NULL DEFAULT 'image' CHECK (content_type IN (
    'image', 'video', 'story', 'reel', 'carousel', 'text', 'live', 'poll'
  )),
  planned_date    TIMESTAMPTZ NOT NULL,
  actual_post_id  TEXT REFERENCES social_posts(id),
  status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'content_ready', 'scheduled', 'posted', 'skipped', 'rescheduled'
  )),
  assigned_agent  TEXT,
  category        TEXT NOT NULL DEFAULT 'promotional' CHECK (category IN (
    'promotional', 'educational', 'behind_the_scenes', 'engagement', 'milestone',
    'product_launch', 'testimonial', 'seasonal'
  )),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_calendar_date ON content_calendar (planned_date);
CREATE INDEX idx_content_calendar_status ON content_calendar (status);
CREATE INDEX idx_content_calendar_account ON content_calendar (account_id);
CREATE INDEX idx_content_calendar_campaign ON content_calendar (campaign_id);

-- ── Extend marketplace_tasks CHECK to include social task types ──────────────
ALTER TABLE marketplace_tasks
  DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'translate', 'write', 'review', 'proofread', 'format', 'cover_design',
    'genre_research', 'design', 'research', 'support',
    'misiuni_post', 'misiuni_verify',
    'legal_research', 'print_broker', 'trend_research', 'author_persona',
    'social_post', 'social_analytics'
  ));

COMMIT;

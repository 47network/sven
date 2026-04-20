-- Batch 62: Agent Marketplace Recommendations
-- Recommendation engine for marketplace services, skills, and agents

CREATE TABLE IF NOT EXISTS agent_recommendations (
  id             TEXT PRIMARY KEY,
  target_agent_id TEXT NOT NULL,
  source_type    TEXT NOT NULL CHECK (source_type IN ('collaborative','content','trending','personalized','similar')),
  item_type      TEXT NOT NULL CHECK (item_type IN ('skill','service','agent','product','crew')),
  item_id        TEXT NOT NULL,
  score          NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  reason         TEXT,
  context        JSONB DEFAULT '{}',
  viewed         BOOLEAN DEFAULT FALSE,
  clicked        BOOLEAN DEFAULT FALSE,
  converted      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS recommendation_models (
  id             TEXT PRIMARY KEY,
  model_name     TEXT NOT NULL,
  model_type     TEXT NOT NULL CHECK (model_type IN ('collaborative_filter','content_based','hybrid','popularity','contextual')),
  version        TEXT NOT NULL DEFAULT '1.0.0',
  accuracy       NUMERIC(5,4),
  training_data  JSONB DEFAULT '{}',
  parameters     JSONB DEFAULT '{}',
  status         TEXT NOT NULL CHECK (status IN ('training','active','deprecated','failed')) DEFAULT 'training',
  last_trained   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_interactions (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL,
  item_type      TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  interaction    TEXT NOT NULL CHECK (interaction IN ('view','click','purchase','dismiss','bookmark','share')),
  duration_ms    INTEGER,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_campaigns (
  id             TEXT PRIMARY KEY,
  campaign_name  TEXT NOT NULL,
  campaign_type  TEXT NOT NULL CHECK (campaign_type IN ('seasonal','launch','trending','clearance','personalized')),
  target_segment TEXT,
  item_ids       TEXT[] DEFAULT '{}',
  boost_factor   NUMERIC(3,2) DEFAULT 1.0,
  start_date     TIMESTAMPTZ NOT NULL,
  end_date       TIMESTAMPTZ,
  status         TEXT NOT NULL CHECK (status IN ('draft','active','paused','completed','cancelled')) DEFAULT 'draft',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id                TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL REFERENCES agent_recommendations(id),
  agent_id          TEXT NOT NULL,
  feedback_type     TEXT NOT NULL CHECK (feedback_type IN ('helpful','not_helpful','irrelevant','already_owned','too_expensive')),
  comment           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rec_target_agent ON agent_recommendations(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_rec_source_type ON agent_recommendations(source_type);
CREATE INDEX IF NOT EXISTS idx_rec_item_type ON agent_recommendations(item_type);
CREATE INDEX IF NOT EXISTS idx_rec_score ON agent_recommendations(score DESC);
CREATE INDEX IF NOT EXISTS idx_rec_created ON agent_recommendations(created_at);
CREATE INDEX IF NOT EXISTS idx_rec_expires ON agent_recommendations(expires_at);
CREATE INDEX IF NOT EXISTS idx_rec_viewed ON agent_recommendations(viewed);
CREATE INDEX IF NOT EXISTS idx_rec_model_type ON recommendation_models(model_type);
CREATE INDEX IF NOT EXISTS idx_rec_model_status ON recommendation_models(status);
CREATE INDEX IF NOT EXISTS idx_rec_model_name ON recommendation_models(model_name);
CREATE INDEX IF NOT EXISTS idx_rec_inter_agent ON recommendation_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_rec_inter_item ON recommendation_interactions(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_rec_inter_type ON recommendation_interactions(interaction);
CREATE INDEX IF NOT EXISTS idx_rec_inter_created ON recommendation_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_rec_camp_type ON recommendation_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_rec_camp_status ON recommendation_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_rec_camp_dates ON recommendation_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rec_fb_rec ON recommendation_feedback(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_rec_fb_agent ON recommendation_feedback(agent_id);

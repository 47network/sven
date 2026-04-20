-- Batch 61 — Agent Feedback & Surveys
-- Adds feedback collection, survey management, response tracking,
-- sentiment analysis, and feedback-driven improvement loops.

BEGIN;

-- 1. Feedback submissions from users/agents about agent services
CREATE TABLE IF NOT EXISTS agent_feedback (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  submitter_id    TEXT NOT NULL,
  feedback_type   TEXT NOT NULL CHECK (feedback_type IN ('rating','comment','suggestion','complaint','praise')),
  category        TEXT NOT NULL CHECK (category IN ('quality','speed','accuracy','communication','value')),
  rating          INTEGER CHECK (rating >= 1 AND rating <= 5),
  title           TEXT,
  body            TEXT,
  sentiment       TEXT CHECK (sentiment IN ('positive','neutral','negative','mixed','unknown')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','acknowledged','actioned','archived')),
  source          TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct','survey','automated','third_party','internal')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Survey definitions
CREATE TABLE IF NOT EXISTS agent_surveys (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  survey_type     TEXT NOT NULL CHECK (survey_type IN ('satisfaction','nps','feature_request','exit','onboarding')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','closed','archived')),
  questions       JSONB NOT NULL DEFAULT '[]',
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','customers','agents','internal','beta_users')),
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  max_responses   INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Survey responses
CREATE TABLE IF NOT EXISTS agent_survey_responses (
  id              TEXT PRIMARY KEY,
  survey_id       TEXT NOT NULL REFERENCES agent_surveys(id) ON DELETE CASCADE,
  respondent_id   TEXT NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}',
  score           NUMERIC(5,2),
  completion_pct  INTEGER NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned','invalidated','partial')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Feedback analytics / aggregated insights
CREATE TABLE IF NOT EXISTS agent_feedback_analytics (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  period          TEXT NOT NULL CHECK (period IN ('hourly','daily','weekly','monthly','quarterly')),
  period_start    TIMESTAMPTZ NOT NULL,
  total_feedback  INTEGER NOT NULL DEFAULT 0,
  avg_rating      NUMERIC(3,2),
  nps_score       INTEGER,
  sentiment_dist  JSONB DEFAULT '{}',
  category_dist   JSONB DEFAULT '{}',
  top_themes      JSONB DEFAULT '[]',
  response_rate   NUMERIC(5,2),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Feedback-driven improvement actions
CREATE TABLE IF NOT EXISTS agent_improvement_actions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  feedback_ids    TEXT[] NOT NULL DEFAULT '{}',
  action_type     TEXT NOT NULL CHECK (action_type IN ('skill_update','behavior_change','prompt_tuning','escalation','training')),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low','deferred')),
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','in_progress','completed','rejected')),
  outcome         TEXT,
  impact_score    NUMERIC(5,2),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_id ON agent_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_submitter_id ON agent_feedback(submitter_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_type ON agent_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_status ON agent_feedback(status);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created ON agent_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_surveys_agent_id ON agent_surveys(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_surveys_status ON agent_surveys(status);
CREATE INDEX IF NOT EXISTS idx_agent_surveys_type ON agent_surveys(survey_type);
CREATE INDEX IF NOT EXISTS idx_agent_survey_responses_survey ON agent_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_agent_survey_responses_respondent ON agent_survey_responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_agent_survey_responses_status ON agent_survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_analytics_agent ON agent_feedback_analytics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_analytics_period ON agent_feedback_analytics(period, period_start);
CREATE INDEX IF NOT EXISTS idx_agent_improvement_actions_agent ON agent_improvement_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_improvement_actions_status ON agent_improvement_actions(status);
CREATE INDEX IF NOT EXISTS idx_agent_improvement_actions_priority ON agent_improvement_actions(priority);
CREATE INDEX IF NOT EXISTS idx_agent_improvement_actions_type ON agent_improvement_actions(action_type);

COMMIT;

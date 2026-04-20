-- Batch 82: Agent Content Moderation
-- Tables for content moderation policies, reviews, appeals, and moderation queues

CREATE TABLE IF NOT EXISTS moderation_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('spam','abuse','nsfw','copyright','misinformation','harassment','illegal','custom')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  action TEXT NOT NULL DEFAULT 'flag' CHECK (action IN ('flag','hide','remove','ban','warn','escalate')),
  rules JSONB DEFAULT '[]',
  auto_enforce BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_reviews (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('listing','message','review','comment','profile','plugin','skill','file')),
  policy_id TEXT REFERENCES moderation_policies(id),
  reviewer_agent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','escalated','appealed')),
  verdict TEXT CHECK (verdict IN ('clean','violation','borderline','false_positive')),
  confidence NUMERIC(5,4) DEFAULT 0,
  reason TEXT,
  auto_detected BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES moderation_reviews(id) ON DELETE CASCADE,
  appellant_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','granted','denied','withdrawn')),
  reviewer_id TEXT,
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_queue (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES moderation_reviews(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  queue_type TEXT NOT NULL DEFAULT 'general' CHECK (queue_type IN ('general','urgent','escalated','appeal','automated')),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES moderation_reviews(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('flag','hide','remove','ban','warn','restore','escalate','dismiss')),
  performed_by TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  reason TEXT,
  reversible BOOLEAN DEFAULT true,
  reversed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for moderation_policies
CREATE INDEX idx_moderation_policies_category ON moderation_policies(category);
CREATE INDEX idx_moderation_policies_severity ON moderation_policies(severity);
CREATE INDEX idx_moderation_policies_enabled ON moderation_policies(enabled);

-- Indexes for moderation_reviews
CREATE INDEX idx_moderation_reviews_content ON moderation_reviews(content_id);
CREATE INDEX idx_moderation_reviews_content_type ON moderation_reviews(content_type);
CREATE INDEX idx_moderation_reviews_policy ON moderation_reviews(policy_id);
CREATE INDEX idx_moderation_reviews_status ON moderation_reviews(status);
CREATE INDEX idx_moderation_reviews_verdict ON moderation_reviews(verdict);
CREATE INDEX idx_moderation_reviews_reviewer ON moderation_reviews(reviewer_agent_id);
CREATE INDEX idx_moderation_reviews_created ON moderation_reviews(created_at DESC);

-- Indexes for moderation_appeals
CREATE INDEX idx_moderation_appeals_review ON moderation_appeals(review_id);
CREATE INDEX idx_moderation_appeals_appellant ON moderation_appeals(appellant_id);
CREATE INDEX idx_moderation_appeals_status ON moderation_appeals(status);

-- Indexes for moderation_queue
CREATE INDEX idx_moderation_queue_review ON moderation_queue(review_id);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority DESC);
CREATE INDEX idx_moderation_queue_type ON moderation_queue(queue_type);
CREATE INDEX idx_moderation_queue_assigned ON moderation_queue(assigned_to);

-- Indexes for moderation_actions
CREATE INDEX idx_moderation_actions_review ON moderation_actions(review_id);
CREATE INDEX idx_moderation_actions_type ON moderation_actions(action_type);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_id);
CREATE INDEX idx_moderation_actions_created ON moderation_actions(created_at DESC);

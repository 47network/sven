-- Migration: Batch 3 (Community Agents) + Batch 4 (Calibrated Intelligence)
-- Created: 2026-04-08
-- Description: Agent persona identity, agent-to-agent protocol, rate limiting,
--   smart moderation, transparency changelog, confidence scoring, correction
--   pipeline, pattern observation, feedback routing.

BEGIN;

-- ═══════════════════════════════════════════════════════════════
-- BATCH 3: Community Agents + Transparency
-- ═══════════════════════════════════════════════════════════════

-- 3.1 — Agent persona identity (standalone table for community agents)
CREATE TABLE IF NOT EXISTS agent_personas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_agent BOOLEAN NOT NULL DEFAULT TRUE,
  agent_persona_type TEXT NOT NULL
    CHECK (agent_persona_type IN ('bot', 'advisor', 'assistant', 'moderator', 'custom')),
  persona_display_name TEXT NOT NULL,
  persona_avatar_url TEXT,
  persona_bio TEXT,
  community_visible BOOLEAN NOT NULL DEFAULT FALSE,
  agent_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (agent_status IN ('active', 'inactive', 'suspended', 'observing')),
  system_prompt TEXT NOT NULL DEFAULT '',
  model_name TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN agent_personas.is_agent IS 'True for community-visible agent personas';
COMMENT ON COLUMN agent_personas.agent_persona_type IS 'bot|advisor|assistant|moderator|custom';
COMMENT ON COLUMN agent_personas.agent_status IS 'active=posting, inactive=off, suspended=admin-paused, observing=watch-before-speak';

CREATE INDEX IF NOT EXISTS idx_agent_personas_org
  ON agent_personas (organization_id, agent_status)
  WHERE is_agent = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_personas_type
  ON agent_personas (agent_persona_type)
  WHERE is_agent = TRUE;

-- 3.10 — Agent-to-agent protocol messages
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  from_agent_id TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  to_agent_id TEXT REFERENCES agent_personas(id) ON DELETE SET NULL,
  thread_id TEXT,
  subject TEXT NOT NULL DEFAULT 'general',
  message_type TEXT NOT NULL DEFAULT 'message'
    CHECK (message_type IN ('message', 'mention', 'delegation', 'reply', 'observation', 'report')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_messages_org_thread
  ON agent_messages (organization_id, thread_id, created_at DESC);
CREATE INDEX idx_agent_messages_to_agent
  ON agent_messages (to_agent_id, status, created_at DESC)
  WHERE to_agent_id IS NOT NULL;
CREATE INDEX idx_agent_messages_from_agent
  ON agent_messages (from_agent_id, created_at DESC);

COMMENT ON TABLE agent_messages IS 'Agent-to-agent communication log. All inter-agent messages routed via NATS stored here for auditability';

-- 3.11 — Agent rate limiting & cadence
CREATE TABLE IF NOT EXISTS agent_rate_limits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  max_posts_per_hour INTEGER NOT NULL DEFAULT 10 CHECK (max_posts_per_hour BETWEEN 1 AND 1000),
  max_posts_per_day INTEGER NOT NULL DEFAULT 100 CHECK (max_posts_per_day BETWEEN 1 AND 10000),
  min_interval_seconds INTEGER NOT NULL DEFAULT 30 CHECK (min_interval_seconds BETWEEN 5 AND 3600),
  cadence_profile TEXT NOT NULL DEFAULT 'natural'
    CHECK (cadence_profile IN ('natural', 'burst', 'steady', 'quiet')),
  cooldown_after_rejection_seconds INTEGER NOT NULL DEFAULT 300,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, organization_id)
);

COMMENT ON TABLE agent_rate_limits IS 'Per-agent posting frequency limits. Natural cadence = random jitter for human-like intervals';

-- Agent post activity log (for rate limit enforcement)
CREATE TABLE IF NOT EXISTS agent_post_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL DEFAULT 'community'
    CHECK (post_type IN ('community', 'agent_message', 'changelog', 'report')),
  content_preview TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  moderation_reason TEXT,
  risk_score DOUBLE PRECISION DEFAULT 0.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_post_log_rate
  ON agent_post_log (agent_id, organization_id, created_at DESC);
CREATE INDEX idx_agent_post_log_moderation
  ON agent_post_log (moderation_status, created_at DESC)
  WHERE moderation_status = 'pending';

-- 3.12 — Transparency changelog
CREATE TABLE IF NOT EXISTS transparency_changelog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  author_agent_id TEXT REFERENCES agent_personas(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL DEFAULT 'learned'
    CHECK (entry_type IN ('learned', 'improved', 'fixed', 'observed', 'milestone', 'community')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'community', 'admin_only')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transparency_changelog_org
  ON transparency_changelog (organization_id, published_at DESC)
  WHERE published_at IS NOT NULL;

COMMENT ON TABLE transparency_changelog IS 'Sven writes own public changelog in first person. Community agents are the authors';

-- 3.13 — Smart agent moderator (moderation decisions)
CREATE TABLE IF NOT EXISTS agent_moderation_decisions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  post_log_id TEXT NOT NULL REFERENCES agent_post_log(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('auto_approve', 'flag_for_review', 'reject')),
  risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  risk_factors JSONB DEFAULT '[]',
  explanation TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  final_decision TEXT CHECK (final_decision IN ('approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_moderation_pending_review
  ON agent_moderation_decisions (organization_id, created_at DESC)
  WHERE final_decision IS NULL AND decision = 'flag_for_review';

COMMENT ON TABLE agent_moderation_decisions IS 'Smart moderation: auto-approve safe posts, flag risky ones for admin review';

-- ═══════════════════════════════════════════════════════════════
-- BATCH 4: Calibrated Intelligence + Self-Improvement
-- ═══════════════════════════════════════════════════════════════

-- 4.1 — Confidence scoring per response
CREATE TABLE IF NOT EXISTS response_confidence (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  overall_confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5
    CHECK (overall_confidence >= 0.0 AND overall_confidence <= 1.0),
  rag_relevance_score DOUBLE PRECISION,
  memory_recency_score DOUBLE PRECISION,
  tool_success_score DOUBLE PRECISION,
  model_uncertainty_score DOUBLE PRECISION,
  factors JSONB DEFAULT '{}',
  disclosed_to_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_response_confidence_chat
  ON response_confidence (chat_id, created_at DESC);
CREATE INDEX idx_response_confidence_low
  ON response_confidence (organization_id, overall_confidence, created_at DESC)
  WHERE overall_confidence < 0.5;

COMMENT ON TABLE response_confidence IS 'Per-response confidence scoring. Feeds uncertainty disclosure and calibration metrics';

-- 4.3 — Feedback routing improvement (extends message_feedback with routing data)
CREATE TABLE IF NOT EXISTS feedback_routing_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  feedback_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  feedback_signal TEXT NOT NULL CHECK (feedback_signal IN ('up', 'down')),
  model_used TEXT,
  skill_used TEXT,
  task_type TEXT,
  confidence_at_response DOUBLE PRECISION,
  routing_context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_routing_model
  ON feedback_routing_signals (model_used, feedback_signal, created_at DESC)
  WHERE model_used IS NOT NULL;
CREATE INDEX idx_feedback_routing_skill
  ON feedback_routing_signals (skill_used, feedback_signal, created_at DESC)
  WHERE skill_used IS NOT NULL;
CREATE INDEX idx_feedback_routing_task
  ON feedback_routing_signals (task_type, feedback_signal, created_at DESC)
  WHERE task_type IS NOT NULL;

COMMENT ON TABLE feedback_routing_signals IS 'Enriched feedback data for routing improvement. Maps thumbs up/down to models, skills, task types';

-- 4.4 / 4.5 — Correction pipeline
CREATE TABLE IF NOT EXISTS user_corrections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  original_response TEXT NOT NULL,
  correction_text TEXT NOT NULL,
  user_reasoning TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'conflicting', 'expired')),
  verification_methods JSONB DEFAULT '[]',
  verification_evidence JSONB DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  confidence_after_verification DOUBLE PRECISION,
  promoted_to_memory BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_memory_id TEXT,
  topic TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_corrections_pending
  ON user_corrections (organization_id, verification_status, created_at DESC)
  WHERE verification_status = 'pending';
CREATE INDEX idx_corrections_topic
  ON user_corrections (topic, organization_id, created_at DESC)
  WHERE topic IS NOT NULL;
CREATE INDEX idx_corrections_user
  ON user_corrections (user_id, organization_id, created_at DESC);

COMMENT ON TABLE user_corrections IS 'User corrections verified before acceptance. Multi-strategy validation prevents bad corrections from poisoning memory';

-- 4.6 — Pattern observation system
CREATE TABLE IF NOT EXISTS observed_patterns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL
    CHECK (pattern_type IN ('repeated_question', 'common_struggle', 'unexpected_workflow',
                            'feature_request', 'recurring_error', 'expertise_gap')),
  description TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'observed'
    CHECK (status IN ('observed', 'confirmed', 'actioned', 'dismissed')),
  actioned_by TEXT,
  actioned_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_observed_patterns_type
  ON observed_patterns (organization_id, pattern_type, occurrence_count DESC);
CREATE INDEX idx_observed_patterns_active
  ON observed_patterns (organization_id, status, last_seen_at DESC)
  WHERE status IN ('observed', 'confirmed');

COMMENT ON TABLE observed_patterns IS 'Agent observation system. Track repeated questions, common struggles, unexpected workflows before acting';

-- 4.7 — Self-improvement metrics (aggregated snapshots)
CREATE TABLE IF NOT EXISTS self_improvement_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  total_responses INTEGER NOT NULL DEFAULT 0,
  corrections_received INTEGER NOT NULL DEFAULT 0,
  corrections_verified INTEGER NOT NULL DEFAULT 0,
  corrections_rejected INTEGER NOT NULL DEFAULT 0,
  avg_confidence DOUBLE PRECISION,
  confidence_calibration_error DOUBLE PRECISION,
  most_corrected_topics JSONB DEFAULT '[]',
  memory_utilization_pct DOUBLE PRECISION,
  human_understanding_score DOUBLE PRECISION,
  feedback_positive_count INTEGER NOT NULL DEFAULT 0,
  feedback_negative_count INTEGER NOT NULL DEFAULT 0,
  patterns_observed INTEGER NOT NULL DEFAULT 0,
  patterns_actioned INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, snapshot_date)
);

COMMENT ON TABLE self_improvement_snapshots IS 'Daily self-improvement metrics. Tracks correction rate, confidence calibration, memory utilization over time';

COMMIT;

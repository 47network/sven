-- Batch 2: Quantum Fading Memory + Emotional Intelligence
-- Adds quantum_fade decay type, importance-weighted persistence,
-- consolidation pipeline fields, brain visualization support,
-- emotional intelligence tracking, and GDPR consent layer.

-- 1. Extend memories table for quantum fade
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS decay_type TEXT NOT NULL DEFAULT 'exponential',
  ADD COLUMN IF NOT EXISTS gamma DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS amplitude DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS omega DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS phase_offset DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS resonance_boost_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resonance_at TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS consolidation_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consolidated_kg_node_id TEXT DEFAULT NULL;

COMMENT ON COLUMN memories.decay_type IS 'Decay curve type: linear, exponential, step, or quantum_fade';
COMMENT ON COLUMN memories.gamma IS 'Quantum fade: base decay rate (lower = slower fade)';
COMMENT ON COLUMN memories.amplitude IS 'Quantum fade: oscillation amplitude (resonance echo strength)';
COMMENT ON COLUMN memories.omega IS 'Quantum fade: oscillation frequency (resonance interval)';
COMMENT ON COLUMN memories.phase_offset IS 'Quantum fade: phase offset (prevents synchronized resonance)';
COMMENT ON COLUMN memories.resonance_boost_count IS 'Times this memory was referenced (resonance boost)';
COMMENT ON COLUMN memories.consolidation_status IS 'NULL=active, pending=queued, done=consolidated to KG';
COMMENT ON COLUMN memories.consolidated_kg_node_id IS 'FK to kg_entities.id after consolidation';

-- Index for consolidation pipeline sweep
CREATE INDEX IF NOT EXISTS idx_memories_decay_type ON memories (decay_type) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_memories_consolidation_status ON memories (consolidation_status) WHERE consolidation_status IS NOT NULL;

-- 2. Quantum fade configuration table (per-org or global)
CREATE TABLE IF NOT EXISTS quantum_fade_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT DEFAULT NULL,
  gamma_base DOUBLE PRECISION NOT NULL DEFAULT 0.05,
  amplitude DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  omega DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  consolidation_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  resonance_factor DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  consolidation_interval_hours INTEGER NOT NULL DEFAULT 6,
  max_memory_budget_mb INTEGER NOT NULL DEFAULT 512,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id)
);

COMMENT ON TABLE quantum_fade_config IS 'Quantum fading memory configuration (per-org or global when org is NULL)';

-- 3. Emotional intelligence tracking
CREATE TABLE IF NOT EXISTS emotional_states (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  organization_id TEXT DEFAULT NULL,
  chat_id TEXT DEFAULT NULL,
  message_id TEXT DEFAULT NULL,
  detected_mood TEXT NOT NULL,
  sentiment_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  frustration_level DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  excitement_level DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  confusion_level DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  raw_signals JSONB DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emotional_states_user_id ON emotional_states (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotional_states_chat_id ON emotional_states (chat_id, created_at DESC);

COMMENT ON TABLE emotional_states IS 'Tracks detected emotional states per message for adaptive response';

-- 4. User reasoning capture
CREATE TABLE IF NOT EXISTS user_reasoning (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  organization_id TEXT DEFAULT NULL,
  chat_id TEXT DEFAULT NULL,
  topic TEXT NOT NULL,
  user_choice TEXT NOT NULL,
  sven_suggestion TEXT DEFAULT NULL,
  reasoning TEXT NOT NULL,
  expertise_area TEXT DEFAULT NULL,
  pattern_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_reasoning_user_id ON user_reasoning (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reasoning_topic ON user_reasoning (topic);

COMMENT ON TABLE user_reasoning IS 'Captures WHY users make decisions — understanding human reasoning patterns';

-- 5. Human understanding model (aggregated user decision patterns)
CREATE TABLE IF NOT EXISTS user_understanding (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  organization_id TEXT DEFAULT NULL,
  dimension TEXT NOT NULL,
  pattern_summary TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  last_evidence_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, organization_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_user_understanding_user_id ON user_understanding (user_id);

COMMENT ON TABLE user_understanding IS 'Aggregated model of each users decision-making patterns and preferences';
COMMENT ON COLUMN user_understanding.dimension IS 'Area of understanding: risk_tolerance, tech_preferences, communication_style, domain_expertise, decision_speed, etc.';

-- 6. Memory consent layer (GDPR Articles 15-17)
CREATE TABLE IF NOT EXISTS memory_consent (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  organization_id TEXT DEFAULT NULL,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_scope TEXT NOT NULL DEFAULT 'full',
  retention_days INTEGER DEFAULT NULL,
  allow_consolidation BOOLEAN NOT NULL DEFAULT true,
  allow_emotional_tracking BOOLEAN NOT NULL DEFAULT true,
  allow_reasoning_capture BOOLEAN NOT NULL DEFAULT true,
  forget_requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  forget_completed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  last_export_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, organization_id)
);

COMMENT ON TABLE memory_consent IS 'GDPR consent layer — controls what Sven can remember per user';
COMMENT ON COLUMN memory_consent.consent_scope IS 'full=everything, conversation=chat only, facts=KG only';
COMMENT ON COLUMN memory_consent.retention_days IS 'NULL=use system default, otherwise user-specified max retention';
COMMENT ON COLUMN memory_consent.forget_requested_at IS 'GDPR Article 17 — right to erasure request timestamp';

-- Insert global default quantum fade config
INSERT INTO quantum_fade_config (organization_id, gamma_base, amplitude, omega, consolidation_threshold, resonance_factor, consolidation_interval_hours, max_memory_budget_mb)
VALUES (NULL, 0.05, 0.3, 0.5, 0.15, 0.2, 6, 512)
ON CONFLICT (organization_id) DO NOTHING;

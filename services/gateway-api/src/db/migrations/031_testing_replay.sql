-- Testing & Replay Harness Schema
-- Tracks synthetic scenarios, replay runs, and output comparisons
-- Version: 1.0
-- Date: 2026-02-11

-- ============== SCENARIOS ==============

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100), -- 'chat_basic', 'approvals', 'tools', 'integration', etc.
  
  -- Input
  chat_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  
  -- Expected outputs
  expected_assistant_response TEXT,
  expected_tool_calls JSONB[], -- array of expected tool calls
  expected_approvals_required BOOLEAN,
  expected_canvas_blocks JSONB[], -- expected canvas output blocks
  
  -- Metadata
  priority INT DEFAULT 0, -- higher = run first
  tags TEXT[] DEFAULT '{}',
  retry_count INT DEFAULT 3,
  timeout_seconds INT DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  
  CONSTRAINT fk_scenario_chat FOREIGN KEY (chat_id) REFERENCES chats(id)
);

CREATE INDEX IF NOT EXISTS idx_scenarios_category ON scenarios(category);
CREATE INDEX IF NOT EXISTS idx_scenarios_is_active ON scenarios(is_active);
CREATE INDEX IF NOT EXISTS idx_scenarios_priority ON scenarios(priority DESC);

-- ============== SCENARIO VARIATIONS ==============

CREATE TABLE IF NOT EXISTS scenario_variations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scenario_id TEXT NOT NULL,
  
  -- Variation parameters (e.g., different user contexts, settings, etc.)
  name VARCHAR(255),
  parameters JSONB, -- {"user_role": "admin", "feature_flag": "enabled", ...}
  
  -- Overrides for this variation
  override_message TEXT,
  override_expected_response TEXT,
  override_expected_tools JSONB[],
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_variation_scenario FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenario_variations_scenario ON scenario_variations(scenario_id);

-- ============== REPLAY RUNS ==============

CREATE TABLE IF NOT EXISTS replay_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  build_version VARCHAR(100), -- e.g., "v0.1.0-beta.5"
  baseline_build_version VARCHAR(100), -- optional, for comparison
  
  -- Scope
  scenario_ids TEXT[] NOT NULL, -- which scenarios to run
  filter_category VARCHAR(100), -- optional: only run scenarios in category
  
  -- Execution
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_scenarios INT,
  passed_scenarios INT DEFAULT 0,
  failed_scenarios INT DEFAULT 0,
  error_message TEXT,
  
  -- Results summary
  output_deltas JSONB, -- summary of differences found
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- ============== REPLAY RESULTS ==============

CREATE TABLE IF NOT EXISTS replay_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  replay_run_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  variation_id TEXT,
  
  -- Execution tracking
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INT,
  
  -- Actual outputs from this run
  actual_assistant_response TEXT,
  actual_tool_calls JSONB[], -- what tools were actually called
  actual_approvals_required BOOLEAN,
  actual_canvas_blocks JSONB[],
  
  -- Pass/Fail
  passed BOOLEAN,
  mismatches JSONB, -- { "assistant_response": {...}, "tool_calls": [...], ...}
  similarity_score FLOAT, -- 0.0-1.0 (how similar to expected)
  
  -- Logs for debugging
  logs TEXT,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_result_replay FOREIGN KEY (replay_run_id) REFERENCES replay_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_result_scenario FOREIGN KEY (scenario_id) REFERENCES scenarios(id),
  CONSTRAINT fk_result_variation FOREIGN KEY (variation_id) REFERENCES scenario_variations(id) ON DELETE SET NULL
);

-- ============== OUTPUT COMPARISON ==============

CREATE TABLE IF NOT EXISTS output_comparisons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Comparing two replay runs (baseline vs new build)
  baseline_replay_run_id TEXT NOT NULL,
  new_replay_run_id TEXT NOT NULL,
  
  -- Comparison type
  comparison_type VARCHAR(50) DEFAULT 'full', -- full, assistant_only, tools_only, approvals_only
  
  -- Results
  total_scenarios INT,
  identical_scenarios INT,
  regression_scenarios INT, -- new failures
  improvement_scenarios INT, -- new passes
  delta_threshold FLOAT DEFAULT 0.05, -- 5% difference threshold
  
  -- Detailed deltas
  deltas JSONB, -- {scenario_id: {change_type: 'tool_call_added'|'response_changed'|...}}
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_comparison_baseline FOREIGN KEY (baseline_replay_run_id) REFERENCES replay_runs(id),
  CONSTRAINT fk_comparison_new FOREIGN KEY (new_replay_run_id) REFERENCES replay_runs(id)
);

-- ============== REPLAY AUDIT LOG ==============

CREATE TABLE IF NOT EXISTS replay_audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action_type VARCHAR(100), -- 'scenario_created', 'replay_started', 'replay_completed', etc.
  resource_type VARCHAR(100), -- 'scenario', 'replay_run', 'comparison'
  resource_id TEXT,
  actor_user_id TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_replay_runs_status ON replay_runs(status);
CREATE INDEX IF NOT EXISTS idx_replay_runs_build_version ON replay_runs(build_version);
CREATE INDEX IF NOT EXISTS idx_replay_runs_created_at ON replay_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_result_replay ON replay_results(replay_run_id);
CREATE INDEX IF NOT EXISTS idx_result_scenario ON replay_results(scenario_id);
CREATE INDEX IF NOT EXISTS idx_result_passed ON replay_results(passed);
CREATE INDEX IF NOT EXISTS idx_comparison_baseline ON output_comparisons(baseline_replay_run_id);
CREATE INDEX IF NOT EXISTS idx_comparison_new ON output_comparisons(new_replay_run_id);
CREATE INDEX IF NOT EXISTS idx_comparison_created_at ON output_comparisons(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON replay_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON replay_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON replay_audit_log(created_at DESC);

-- ============== SEED SCENARIOS ==============

-- Basic chat scenario
INSERT INTO scenarios (
  name, description, category, chat_id,
  user_message, expected_assistant_response,
  expected_tool_calls, expected_approvals_required,
  tags, priority
) SELECT
  'basic_greeting',
  'Test basic greeting and response',
  'chat_basic',
  id,
  'Hello, how are you?',
  'I''m doing well, thank you for asking!',
  '{}',
  FALSE,
  ARRAY['greeting', 'basic'],
  10
FROM chats
WHERE name = 'HQ'
LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- Tool invocation scenario
INSERT INTO scenarios (
  name, description, category, chat_id,
  user_message, expected_assistant_response,
  expected_approvals_required,
  tags, priority
) SELECT
  'home_assistant_list_entities',
  'Test HA entity listing',
  'tools',
  id,
  'What Home Assistant entities do I have?',
  NULL,
  FALSE,
  ARRAY['home_assistant', 'read'],
  5
FROM chats
WHERE name = 'HQ'
LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- Approval scenario
INSERT INTO scenarios (
  name, description, category, chat_id,
  user_message, expected_assistant_response,
  expected_approvals_required,
  tags, priority
) SELECT
  'approval_needed_for_write',
  'Test that write operation requires approval',
  'approvals',
  id,
  'Please disable all lights',
  NULL,
  TRUE,
  ARRAY['approval', 'safe'],
  8
FROM chats
WHERE name = 'HQ'
LIMIT 1
ON CONFLICT (name) DO NOTHING;

-- Multi-tool scenario
INSERT INTO scenarios (
  name, description, category, chat_id,
  user_message, expected_assistant_response,
  expected_approvals_required,
  tags, priority
) SELECT
  'multi_tool_workflow',
  'Test workflow with multiple tool calls',
  'integration',
  id,
  'Check temperature and turn on AC if above 24 degrees',
  NULL,
  FALSE,
  ARRAY['workflow', 'multi_step'],
  3
FROM chats
WHERE name = 'HQ'
LIMIT 1
ON CONFLICT (name) DO NOTHING;

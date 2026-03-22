-- Performance & Scaling Infrastructure
-- Backpressure management, caching, queue monitoring, and inference routing

-- ============== QUEUE MONITORING ==============

CREATE TABLE IF NOT EXISTS queue_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Queue identification
  queue_type VARCHAR(50) NOT NULL, -- indexing, runtime, skills, approvals, outbox
  queue_name VARCHAR(100) NOT NULL,
  
  -- Depth tracking (samples over time)
  sampled_at TIMESTAMP NOT NULL,
  queue_depth INTEGER NOT NULL,
  queue_capacity INTEGER,
  depth_percentage NUMERIC(5, 2), -- 0-100
  
  -- Performance metrics
  avg_processing_time_ms NUMERIC(10, 2),
  p95_processing_time_ms NUMERIC(10, 2),
  throughput_per_minute INTEGER,
  
  -- Health indicators
  stalled BOOLEAN DEFAULT FALSE,
  error_rate NUMERIC(5, 2), -- 0-100
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== BACKPRESSURE CONFIGURATION ==============

CREATE TABLE IF NOT EXISTS backpressure_policies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Policy scope
  policy_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Trigger thresholds (when to apply backpressure)
  queue_depth_threshold INTEGER, -- trigger at N items
  queue_depth_percent_threshold NUMERIC(5, 2), -- trigger at X% full
  error_rate_threshold NUMERIC(5, 2), -- trigger at X% errors
  p95_latency_threshold_ms INTEGER, -- trigger above Xms
  
  -- Queue pause order (which queues to pause first)
  pause_order TEXT[] DEFAULT ARRAY['indexing', 'skills', 'runtime'], -- pause in this sequence
  
  -- Action configuration
  pause_indexing BOOLEAN DEFAULT TRUE,
  pause_new_tools BOOLEAN DEFAULT FALSE,
  pause_new_runtime BOOLEAN DEFAULT FALSE,
  reduce_concurrent_skills INTEGER DEFAULT 1, -- reduce concurrency by this
  rate_limit_ttl_ms INTEGER DEFAULT 5000, -- backpressure duration
  
  -- Monitoring
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default backpressure policy
INSERT INTO backpressure_policies (
  policy_name, description, is_active,
  queue_depth_threshold, queue_depth_percent_threshold,
  error_rate_threshold, p95_latency_threshold_ms,
  pause_order
) VALUES (
  'default',
  'Default backpressure policy: pause indexing first, then skills',
  TRUE,
  1000, 75.0,
  10.0, 1000,
  ARRAY['indexing', 'skills', 'runtime']
) ON CONFLICT (policy_name) DO NOTHING;

-- ============== BACKPRESSURE STATE ==============

CREATE TABLE IF NOT EXISTS backpressure_state (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Current backpressure application
  policy_id TEXT NOT NULL REFERENCES backpressure_policies(id),
  is_active BOOLEAN DEFAULT FALSE,
  
  -- Which queues are paused
  paused_queues TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Metrics when triggered
  triggered_at TIMESTAMP,
  triggered_by_condition VARCHAR(100), -- depth|error_rate|latency
  queue_depth_at_trigger INTEGER,
  error_rate_at_trigger NUMERIC(5, 2),
  p95_latency_at_trigger_ms INTEGER,
  
  -- When to deactivate
  scheduled_deactivation_at TIMESTAMP,
  
  -- Monitoring
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== TOOL CACHING ==============

CREATE TABLE IF NOT EXISTS cache_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Tool identification
  tool_name VARCHAR(255) NOT NULL UNIQUE,
  
  -- Cache settings
  cache_enabled BOOLEAN DEFAULT FALSE,
  ttl_seconds INTEGER DEFAULT 300, -- 5 minutes default
  max_entry_size_bytes INTEGER DEFAULT 1048576, -- 1MB default
  max_cache_size_mb INTEGER DEFAULT 100,
  
  -- Cache strategy
  cache_strategy VARCHAR(50) DEFAULT 'lru', -- lru, lfu, fifo
  invalidate_on_write_scope BOOLEAN DEFAULT TRUE, -- clear cache on write operations
  
  -- Metrics
  hit_rate_percent NUMERIC(5, 2),
  miss_rate_percent NUMERIC(5, 2),
  last_stats_update TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed cache config for read-only tools
INSERT INTO cache_config (tool_name, cache_enabled, ttl_seconds, cache_strategy)
VALUES
  ('ha.list_entities', TRUE, 300, 'lru'),
  ('ha.get_state', TRUE, 60, 'lru'),
  ('ha.list_devices', TRUE, 300, 'lru'),
  ('nas.search_files', FALSE, 60, 'lru'),
  ('web.fetch', FALSE, 600, 'lru'),
  ('calendar.list_events', TRUE, 120, 'lru'),
  ('git.status', TRUE, 30, 'lru')
ON CONFLICT (tool_name) DO NOTHING;

-- ============== CACHE STATISTICS ==============

CREATE TABLE IF NOT EXISTS cache_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  tool_name VARCHAR(255) NOT NULL,
  
  -- Counters
  total_requests BIGINT DEFAULT 0,
  cache_hits BIGINT DEFAULT 0,
  cache_misses BIGINT DEFAULT 0,
  evictions BIGINT DEFAULT 0,
  
  -- Sizing
  current_entries INTEGER,
  current_size_bytes BIGINT,
  
  -- Timing
  avg_hit_latency_ms NUMERIC(10, 2),
  avg_miss_latency_ms NUMERIC(10, 2),
  
  sampled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== RAG INCREMENTAL INDEXING ==============

CREATE TABLE IF NOT EXISTS rag_section_hashes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- File identification
  source_id TEXT NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  
  -- Hash tracking
  content_hash VARCHAR(64), -- SHA256 of file content
  index_hash VARCHAR(64), -- SHA256 of indexed chunks
  last_indexed_at TIMESTAMP,
  
  -- Incremental state
  is_changed BOOLEAN DEFAULT FALSE,
  change_detected_at TIMESTAMP,
  
  -- Indexing metrics
  processed_size_bytes BIGINT,
  chunk_count INTEGER,
  indexed_successfully BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(source_id, file_path)
);

-- ============== INFERENCE ROUTING ==============

CREATE TABLE IF NOT EXISTS inference_nodes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Node identification
  node_name VARCHAR(255) NOT NULL UNIQUE,
  endpoint_url VARCHAR(1024) NOT NULL,
  
  -- Node metadata
  node_type VARCHAR(50) NOT NULL, -- local, remote, cloud
  location VARCHAR(100), -- geographic or logical location
  
  -- Capabilities
  supported_models TEXT[], -- models this node can run
  max_concurrent_requests INTEGER DEFAULT 4,
  gpu_enabled BOOLEAN DEFAULT FALSE,
  gpu_vram_gb INTEGER,
  
  -- Health status
  is_healthy BOOLEAN DEFAULT TRUE,
  last_health_check TIMESTAMP,
  consecutive_failures INTEGER DEFAULT 0,
  
  -- Load tracking
  current_load_percent NUMERIC(5, 2),
  avg_response_time_ms NUMERIC(10, 2),
  
  -- Metrics
  total_requests BIGINT DEFAULT 0,
  total_errors BIGINT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed local inference node
INSERT INTO inference_nodes (
  node_name, endpoint_url, node_type, gpu_enabled,
  max_concurrent_requests, supported_models, is_healthy
) VALUES (
  'local-ollama',
  'http://ollama:11434',
  'local',
  FALSE,
  4,
  ARRAY['llama2', 'mistral', 'neural-chat'],
  TRUE
) ON CONFLICT (node_name) DO NOTHING;

-- ============== INFERENCE ROUTING POLICY ==============

CREATE TABLE IF NOT EXISTS inference_routing_policy (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  policy_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Routing logic
  prefer_local_first BOOLEAN DEFAULT TRUE,
  load_threshold_percent NUMERIC(5, 2) DEFAULT 80.0, -- use remote if local > 80%
  failover_on_error BOOLEAN DEFAULT TRUE,
  
  -- Performance profile
  profile_name VARCHAR(50), -- gaming, balanced, performance
  max_latency_ms INTEGER, -- target max latency
  
  -- Model preferences
  preferred_models TEXT[],
  fallback_models TEXT[],
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed routing policies
INSERT INTO inference_routing_policy (
  policy_name, description, is_active, profile_name,
  prefer_local_first, load_threshold_percent, max_latency_ms
) VALUES
  ('gaming', 'Gaming mode: local only, aggressive timeouts', TRUE, 'gaming', TRUE, 60.0, 100),
  ('balanced', 'Balanced: prefer local, fallback to remote', TRUE, 'balanced', TRUE, 80.0, 500),
  ('performance', 'Performance: use best available', TRUE, 'performance', FALSE, 90.0, 2000)
ON CONFLICT (policy_name) DO NOTHING;

-- ============== PERFORMANCE PROFILES ==============

CREATE TABLE IF NOT EXISTS performance_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  profile_name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  
  -- Limits
  max_llm_concurrency INTEGER,
  max_tool_concurrency INTEGER,
  max_indexing_concurrency INTEGER,
  
  -- Timeouts
  llm_timeout_ms INTEGER,
  tool_timeout_ms INTEGER,
  indexing_timeout_ms INTEGER,
  
  -- Caching
  cache_enabled BOOLEAN,
  cache_ttl_seconds INTEGER,
  
  -- Inference routing
  inference_routing_policy_id TEXT REFERENCES inference_routing_policy(id),
  
  -- Feature flags
  enable_buddy_mode BOOLEAN DEFAULT TRUE,
  enable_rag BOOLEAN DEFAULT TRUE,
  enable_workflows BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed performance profiles
INSERT INTO performance_profiles (
  profile_name, description, is_active,
  max_llm_concurrency, max_tool_concurrency, max_indexing_concurrency,
  llm_timeout_ms, tool_timeout_ms, indexing_timeout_ms,
  cache_enabled, cache_ttl_seconds
) VALUES
  ('gaming', 'Gaming mode: minimal concurrency, fast responses', FALSE, 1, 1, 0, 100, 30000, 300000, TRUE, 300),
  ('balanced', 'Balanced mode: moderate concurrency', TRUE, 4, 8, 2, 500, 60000, 600000, TRUE, 600),
  ('performance', 'Performance mode: high concurrency', FALSE, 16, 32, 8, 2000, 300000, 3600000, FALSE, 0)
ON CONFLICT (profile_name) DO NOTHING;

-- ============== LOAD DISTRIBUTION ==============

CREATE TABLE IF NOT EXISTS load_distribution_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  -- Event context
  event_type VARCHAR(100) NOT NULL, -- request_routed, node_exhausted, failover, fallback
  timestamp_ms BIGINT,
  
  -- Routing decision
  inference_node_id TEXT REFERENCES inference_nodes(id) ON DELETE SET NULL,
  selected_model VARCHAR(255),
  
  -- Metrics
  node_load_percent_before NUMERIC(5, 2),
  node_load_percent_after NUMERIC(5, 2),
  response_time_ms NUMERIC(10, 2),
  
  -- Fallback tracking
  fallback_reason VARCHAR(255),
  fallback_node_id TEXT REFERENCES inference_nodes(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== PERFORMANCE STATISTICS ==============

CREATE TABLE IF NOT EXISTS performance_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  stat_period VARCHAR(50), -- hourly, daily, weekly
  stat_type VARCHAR(100), -- latency, throughput, errors, cache_hits, backpressure
  
  -- Aggregated metrics
  metric_name VARCHAR(255),
  min_value NUMERIC(10, 2),
  max_value NUMERIC(10, 2),
  avg_value NUMERIC(10, 2),
  p50_value NUMERIC(10, 2),
  p95_value NUMERIC(10, 2),
  p99_value NUMERIC(10, 2),
  
  -- Additional context
  filter_profile VARCHAR(50), -- gaming, balanced, performance
  filter_tool_type VARCHAR(50),
  
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== TOOL CACHE STORAGE ==============

CREATE TABLE IF NOT EXISTS tool_cache (
  tool_name VARCHAR(255) NOT NULL,
  cache_key VARCHAR(1024) NOT NULL,
  cached_output TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (tool_name, cache_key)
);

-- ============== CACHE EVENTS LOG ==============

CREATE TABLE IF NOT EXISTS cache_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  
  tool_name VARCHAR(255) NOT NULL,
  cache_key VARCHAR(1024) NOT NULL,
  event_type VARCHAR(50), -- hit, miss, evict, write
  timestamp_ms BIGINT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============== INDEXES ==============

CREATE INDEX IF NOT EXISTS idx_queue_metrics_type ON queue_metrics(queue_type);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_sampled ON queue_metrics(sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_created ON queue_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backpressure_active ON backpressure_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_cache_enabled ON cache_config(cache_enabled);
CREATE INDEX IF NOT EXISTS idx_cache_stats_tool ON cache_stats(tool_name);
CREATE INDEX IF NOT EXISTS idx_cache_stats_sampled ON cache_stats(sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_stats_created ON cache_stats(sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_stats_updated ON cache_stats(sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_hashes_source ON rag_section_hashes(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_hashes_changed ON rag_section_hashes(is_changed);
CREATE INDEX IF NOT EXISTS idx_rag_hashes_indexed ON rag_section_hashes(last_indexed_at);
CREATE INDEX IF NOT EXISTS idx_inference_nodes_healthy ON inference_nodes(is_healthy);
CREATE INDEX IF NOT EXISTS idx_inference_nodes_load ON inference_nodes(current_load_percent);
CREATE INDEX IF NOT EXISTS idx_routing_policy_active ON inference_routing_policy(is_active);
CREATE INDEX IF NOT EXISTS idx_load_dist_type ON load_distribution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_load_dist_node ON load_distribution_events(inference_node_id);
CREATE INDEX IF NOT EXISTS idx_load_dist_timestamp ON load_distribution_events(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_load_dist_created ON load_distribution_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_stats_type ON performance_stats(stat_type);
CREATE INDEX IF NOT EXISTS idx_perf_stats_profile ON performance_stats(filter_profile);
CREATE INDEX IF NOT EXISTS idx_perf_stats_recorded ON performance_stats(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_cache_expires ON tool_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tool_cache_created ON tool_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_events_tool ON cache_events(tool_name);
CREATE INDEX IF NOT EXISTS idx_cache_events_type ON cache_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cache_events_created ON cache_events(created_at DESC);

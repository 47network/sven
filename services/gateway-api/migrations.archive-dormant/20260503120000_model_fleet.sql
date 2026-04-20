-- ══════════════════════════════════════════════════════════════════════════
-- Batch 29 — Model Fleet (GPU management, VRAM scheduling, benchmarks)
-- ══════════════════════════════════════════════════════════════════════════

-- ── GPU Devices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gpu_devices (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    hostname        TEXT NOT NULL,
    device_name     TEXT NOT NULL,
    gpu_model       TEXT NOT NULL,
    vram_total_mb   INTEGER NOT NULL,
    vram_used_mb    INTEGER NOT NULL DEFAULT 0,
    vram_reserved_mb INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'offline'
                    CHECK (status IN ('online', 'offline', 'degraded', 'maintenance')),
    wireguard_ip    TEXT,
    driver_version  TEXT,
    compute_capability TEXT,
    temperature_c   INTEGER,
    power_draw_w    INTEGER,
    utilization_pct INTEGER DEFAULT 0,
    last_heartbeat  TIMESTAMPTZ,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_gpu_devices_org     ON gpu_devices (org_id);
CREATE INDEX idx_gpu_devices_status  ON gpu_devices (status);

-- ── Model Deployments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_deployments (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    model_name      TEXT NOT NULL,
    model_variant   TEXT,
    gpu_device_id   TEXT NOT NULL REFERENCES gpu_devices(id) ON DELETE CASCADE,
    vram_required_mb INTEGER NOT NULL,
    quantization    TEXT CHECK (quantization IN ('fp16', 'fp32', 'q8_0', 'q6_k', 'q5_k_m', 'q4_k_m', 'q4_0', 'q3_k_m', 'q2_k', 'gguf', 'awq', 'gptq', 'exl2')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'loading', 'ready', 'unloading', 'failed', 'evicted')),
    priority        INTEGER NOT NULL DEFAULT 5,
    port            INTEGER,
    pid             INTEGER,
    last_inference   TIMESTAMPTZ,
    load_time_ms    INTEGER,
    request_count   BIGINT NOT NULL DEFAULT 0,
    error_count     BIGINT NOT NULL DEFAULT 0,
    deployed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_model_deployments_org    ON model_deployments (org_id);
CREATE INDEX idx_model_deployments_gpu    ON model_deployments (gpu_device_id);
CREATE INDEX idx_model_deployments_status ON model_deployments (status);
CREATE INDEX idx_model_deployments_model  ON model_deployments (model_name);

-- ── Model Benchmarks ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_benchmarks (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    deployment_id   TEXT NOT NULL REFERENCES model_deployments(id) ON DELETE CASCADE,
    benchmark_type  TEXT NOT NULL
                    CHECK (benchmark_type IN ('latency', 'throughput', 'quality', 'cost', 'memory')),
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms      INTEGER NOT NULL,
    tokens_per_second REAL,
    quality_score   REAL CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
    cost_per_1k_tokens REAL,
    vram_peak_mb    INTEGER,
    context_length  INTEGER,
    batch_size      INTEGER DEFAULT 1,
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_model_benchmarks_org        ON model_benchmarks (org_id);
CREATE INDEX idx_model_benchmarks_deployment ON model_benchmarks (deployment_id);
CREATE INDEX idx_model_benchmarks_type       ON model_benchmarks (benchmark_type);

-- ── VRAM Allocation Log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vram_allocation_log (
    id              TEXT PRIMARY KEY,
    org_id          TEXT NOT NULL,
    gpu_device_id   TEXT NOT NULL REFERENCES gpu_devices(id) ON DELETE CASCADE,
    deployment_id   TEXT REFERENCES model_deployments(id) ON DELETE SET NULL,
    action          TEXT NOT NULL CHECK (action IN ('allocate', 'release', 'evict', 'reserve')),
    vram_mb         INTEGER NOT NULL,
    vram_before_mb  INTEGER NOT NULL,
    vram_after_mb   INTEGER NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vram_log_org    ON vram_allocation_log (org_id);
CREATE INDEX idx_vram_log_gpu    ON vram_allocation_log (gpu_device_id);
CREATE INDEX idx_vram_log_action ON vram_allocation_log (action);

-- ── Extend marketplace_tasks ──────────────────────────────────────────────
ALTER TABLE marketplace_tasks
    DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks
ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'translate', 'write', 'review', 'proofread', 'format',
    'cover_design', 'genre_research', 'design', 'research', 'support',
    'misiuni_post', 'misiuni_verify', 'legal_research', 'print_broker',
    'trend_research', 'author_persona', 'social_post', 'social_analytics',
    'merch_listing', 'product_design',
    'council_deliberate', 'council_vote',
    'memory_remember', 'memory_recall', 'memory_compress',
    'fleet_deploy', 'fleet_benchmark', 'fleet_evict'
  ));

-- ── Default fleet config ─────────────────────────────────────────────────
INSERT INTO settings_global (key, value) VALUES
  ('fleet.vram_reserve_pct', '15'),
  ('fleet.eviction_policy', 'lru'),
  ('fleet.heartbeat_interval_s', '30'),
  ('fleet.auto_benchmark', 'true'),
  ('fleet.max_deployments_per_gpu', '4')
ON CONFLICT (key) DO NOTHING;

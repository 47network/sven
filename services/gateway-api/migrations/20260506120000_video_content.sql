-- ============================================================================
-- Batch 32 — Video Content Generation (ffmpeg + Canvas)
-- Persistence layer for the existing video-engine.ts render pipeline
-- ============================================================================

BEGIN;

-- ── render_jobs ────────────────────────────────────────────────
-- Mirrors the RenderJob interface from video-engine.ts
CREATE TABLE IF NOT EXISTS render_jobs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','rendering','completed','failed','cancelled')),
  spec          JSONB NOT NULL,
  template      TEXT CHECK (template IN ('social_media','data_dashboard','product_showcase','tutorial','custom')),
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  output_path   TEXT,
  output_size   BIGINT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_render_jobs_org         ON render_jobs (org_id);
CREATE INDEX idx_render_jobs_user        ON render_jobs (user_id);
CREATE INDEX idx_render_jobs_status      ON render_jobs (status);
CREATE INDEX idx_render_jobs_template    ON render_jobs (template);
CREATE INDEX idx_render_jobs_created     ON render_jobs (created_at DESC);

-- ── video_templates ────────────────────────────────────────────
-- Custom templates beyond the 5 built-in ones in video-engine.ts
CREATE TABLE IF NOT EXISTS video_templates (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  domain        TEXT NOT NULL
                CHECK (domain IN ('social_media','data_dashboard','product_showcase','tutorial','custom')),
  name          TEXT NOT NULL,
  description   TEXT,
  aspect_ratio  TEXT NOT NULL DEFAULT '16:9'
                CHECK (aspect_ratio IN ('16:9','9:16','1:1','4:3')),
  default_spec  JSONB NOT NULL,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_templates_org     ON video_templates (org_id);
CREATE INDEX idx_video_templates_domain  ON video_templates (domain);
CREATE INDEX idx_video_templates_public  ON video_templates (is_public) WHERE is_public = true;

-- ── video_assets ───────────────────────────────────────────────
-- Images, fonts, overlays, audio tracks referenced in specs
CREATE TABLE IF NOT EXISTS video_assets (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL,
  asset_type    TEXT NOT NULL
                CHECK (asset_type IN ('image','font','overlay','audio','logo')),
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  width         INTEGER,
  height        INTEGER,
  duration_ms   INTEGER,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_assets_org        ON video_assets (org_id);
CREATE INDEX idx_video_assets_type       ON video_assets (asset_type);

-- ── ALTER marketplace_tasks ────────────────────────────────────
ALTER TABLE marketplace_tasks DROP CONSTRAINT IF EXISTS marketplace_tasks_task_type_check;
ALTER TABLE marketplace_tasks
  ADD CONSTRAINT marketplace_tasks_task_type_check CHECK (task_type IN (
    'code','research','design','writing','support','testing','review',
    'translate','proofread','format','cover_design','genre_research',
    'misiuni_post','misiuni_verify','social_post','social_analytics',
    'xlvii_design','xlvii_catalog',
    'council_deliberate','council_vote',
    'memory_store','memory_retrieve','memory_compress',
    'fleet_deploy','fleet_benchmark','fleet_evict',
    'evolve_propose','evolve_experiment','evolve_rollback',
    'skill_catalog','skill_import','skill_audit',
    'video_create','video_render','video_preview'
  ));

-- ── default settings ───────────────────────────────────────────
INSERT INTO settings_global (key, value) VALUES
  ('video.max_concurrent_renders', '3'),
  ('video.default_quality_crf', '23'),
  ('video.max_duration_s', '600'),
  ('video.default_fps', '30'),
  ('video.output_format', 'mp4')
ON CONFLICT (key) DO NOTHING;

COMMIT;

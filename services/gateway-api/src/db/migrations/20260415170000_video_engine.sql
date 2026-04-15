-- Epic E: Programmatic Video Generation
-- Migration: 20260415170000_video_engine.sql
-- Tables: video_render_jobs, video_templates_custom

-- ---------------------------------------------------------------------------
-- video_render_jobs — tracks render job lifecycle and output
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_render_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    user_id         UUID NOT NULL,
    title           TEXT NOT NULL DEFAULT 'Untitled Video',
    description     TEXT,
    template        TEXT,           -- template domain or NULL for custom
    spec            JSONB NOT NULL, -- full VideoSpec JSON
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','rendering','completed','failed','cancelled')),
    progress        SMALLINT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    output_path     TEXT,           -- path to rendered file
    output_size     BIGINT,         -- output file size in bytes
    output_format   TEXT DEFAULT 'mp4' CHECK (output_format IN ('mp4','webm')),
    duration_secs   REAL,           -- total video duration
    render_time_ms  INTEGER,        -- time spent rendering
    width           INTEGER NOT NULL DEFAULT 1920,
    height          INTEGER NOT NULL DEFAULT 1080,
    fps             SMALLINT NOT NULL DEFAULT 30,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

-- Indexes for video_render_jobs
CREATE INDEX IF NOT EXISTS idx_video_jobs_org_id ON video_render_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_render_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_render_jobs (status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_template ON video_render_jobs (template) WHERE template IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_jobs_created_at ON video_render_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_org_status ON video_render_jobs (org_id, status);

-- ---------------------------------------------------------------------------
-- video_templates_custom — user-created video templates (org-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_templates_custom (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    domain          TEXT NOT NULL DEFAULT 'custom',
    aspect_ratio    TEXT NOT NULL DEFAULT '16:9'
                    CHECK (aspect_ratio IN ('16:9','9:16','1:1','4:3')),
    spec            JSONB NOT NULL, -- default VideoSpec for this template
    thumbnail_path  TEXT,           -- preview thumbnail
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for video_templates_custom
CREATE INDEX IF NOT EXISTS idx_video_tpl_org_id ON video_templates_custom (org_id);
CREATE INDEX IF NOT EXISTS idx_video_tpl_org_active ON video_templates_custom (org_id, is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Trigger: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_video_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_jobs_updated_at
    BEFORE UPDATE ON video_render_jobs
    FOR EACH ROW EXECUTE FUNCTION update_video_updated_at();

CREATE TRIGGER trg_video_tpl_updated_at
    BEFORE UPDATE ON video_templates_custom
    FOR EACH ROW EXECUTE FUNCTION update_video_updated_at();

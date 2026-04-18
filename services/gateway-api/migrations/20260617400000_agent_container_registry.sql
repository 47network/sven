-- Batch 103 — Agent Container Registry
-- Manages container images, vulnerability scanning, retention

CREATE TABLE IF NOT EXISTS agent_container_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  repository      TEXT NOT NULL,
  tag             TEXT NOT NULL,
  digest          TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  architecture    TEXT NOT NULL DEFAULT 'amd64',
  os              TEXT NOT NULL DEFAULT 'linux',
  pushed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pulled_at  TIMESTAMPTZ,
  pull_count      INTEGER NOT NULL DEFAULT 0,
  labels          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_container_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id        UUID NOT NULL REFERENCES agent_container_images(id) ON DELETE CASCADE,
  scanner         TEXT NOT NULL DEFAULT 'trivy',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  critical_count  INTEGER NOT NULL DEFAULT 0,
  high_count      INTEGER NOT NULL DEFAULT 0,
  medium_count    INTEGER NOT NULL DEFAULT 0,
  low_count       INTEGER NOT NULL DEFAULT 0,
  findings        JSONB NOT NULL DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_container_retention (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  repository      TEXT NOT NULL,
  policy_name     TEXT NOT NULL,
  keep_last       INTEGER NOT NULL DEFAULT 10,
  keep_days       INTEGER,
  tag_pattern     TEXT DEFAULT '*',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  images_cleaned  INTEGER NOT NULL DEFAULT 0,
  bytes_freed     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_container_images_agent ON agent_container_images(agent_id);
CREATE INDEX idx_container_images_repo_tag ON agent_container_images(repository, tag);
CREATE INDEX idx_container_images_digest ON agent_container_images(digest);
CREATE INDEX idx_container_scans_image ON agent_container_scans(image_id);
CREATE INDEX idx_container_scans_status ON agent_container_scans(status);
CREATE INDEX idx_container_retention_agent ON agent_container_retention(agent_id);

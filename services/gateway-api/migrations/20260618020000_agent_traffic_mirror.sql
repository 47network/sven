-- Batch 165: Agent Traffic Mirror
-- Mirror and replay production traffic for testing and debugging

CREATE TABLE IF NOT EXISTS agent_traffic_mirrors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  mirror_name     TEXT NOT NULL,
  source_service  TEXT NOT NULL,
  target_service  TEXT NOT NULL,
  mirror_pct      NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  filter_rules    JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draining','stopped')),
  capture_headers BOOLEAN NOT NULL DEFAULT true,
  capture_body    BOOLEAN NOT NULL DEFAULT false,
  max_body_bytes  INT NOT NULL DEFAULT 10240,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_traffic_captures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mirror_id       UUID NOT NULL REFERENCES agent_traffic_mirrors(id),
  request_method  TEXT NOT NULL,
  request_path    TEXT NOT NULL,
  request_headers JSONB,
  request_body    BYTEA,
  response_status INT,
  response_time_ms INT,
  source_response JSONB,
  target_response JSONB,
  diff_detected   BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_traffic_replays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mirror_id       UUID NOT NULL REFERENCES agent_traffic_mirrors(id),
  replay_name     TEXT NOT NULL,
  capture_count   INT NOT NULL DEFAULT 0,
  replayed_count  INT NOT NULL DEFAULT 0,
  diff_count      INT NOT NULL DEFAULT 0,
  speed_factor    NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','aborted')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_traffic_mirrors_tenant ON agent_traffic_mirrors(tenant_id);
CREATE INDEX idx_traffic_captures_mirror ON agent_traffic_captures(mirror_id);
CREATE INDEX idx_traffic_replays_mirror ON agent_traffic_replays(mirror_id);

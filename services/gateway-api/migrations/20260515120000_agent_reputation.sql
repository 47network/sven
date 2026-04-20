-- Batch 42 — Agent Reputation & Trust Economy
-- Cross-stream reputation scoring and trust verification

CREATE TABLE IF NOT EXISTS agent_reputations (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  overall_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  reliability     NUMERIC(5,2) NOT NULL DEFAULT 0,
  quality         NUMERIC(5,2) NOT NULL DEFAULT 0,
  speed           NUMERIC(5,2) NOT NULL DEFAULT 0,
  collaboration   NUMERIC(5,2) NOT NULL DEFAULT 0,
  innovation      NUMERIC(5,2) NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'newcomer',
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  positive_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  badges          JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_reviews (
  id              TEXT PRIMARY KEY,
  subject_id      TEXT NOT NULL REFERENCES agent_reputations(id),
  reviewer_id     TEXT NOT NULL,
  stream_type     TEXT NOT NULL,
  task_id         TEXT,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  dimension       TEXT NOT NULL,
  comment         TEXT,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  weight          NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trust_connections (
  id              TEXT PRIMARY KEY,
  from_agent_id   TEXT NOT NULL,
  to_agent_id     TEXT NOT NULL,
  trust_level     NUMERIC(5,2) NOT NULL DEFAULT 50,
  connection_type TEXT NOT NULL DEFAULT 'peer',
  interactions    INTEGER NOT NULL DEFAULT 0,
  successful      INTEGER NOT NULL DEFAULT 0,
  last_interaction TIMESTAMPTZ,
  established_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_agent_id, to_agent_id)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  delta           NUMERIC(5,2) NOT NULL DEFAULT 0,
  dimension       TEXT NOT NULL DEFAULT 'overall',
  source_stream   TEXT,
  source_task_id  TEXT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_reputations_agent ON agent_reputations(agent_id);
CREATE INDEX idx_agent_reputations_tier ON agent_reputations(tier);
CREATE INDEX idx_agent_reputations_score ON agent_reputations(overall_score DESC);
CREATE INDEX idx_reputation_reviews_subject ON reputation_reviews(subject_id);
CREATE INDEX idx_reputation_reviews_reviewer ON reputation_reviews(reviewer_id);
CREATE INDEX idx_reputation_reviews_stream ON reputation_reviews(stream_type);
CREATE INDEX idx_trust_connections_from ON trust_connections(from_agent_id);
CREATE INDEX idx_trust_connections_to ON trust_connections(to_agent_id);
CREATE INDEX idx_trust_connections_level ON trust_connections(trust_level DESC);
CREATE INDEX idx_reputation_events_agent ON reputation_events(agent_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);

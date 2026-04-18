-- Batch 104 — Agent GraphQL Gateway
-- Schema federation, query caching, operation analytics

CREATE TABLE IF NOT EXISTS agent_graphql_schemas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  service_name    TEXT NOT NULL,
  schema_sdl      TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','draft')),
  federated       BOOLEAN NOT NULL DEFAULT false,
  breaking_changes JSONB NOT NULL DEFAULT '[]',
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_graphql_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  operation_name  TEXT NOT NULL,
  operation_type  TEXT NOT NULL CHECK (operation_type IN ('query','mutation','subscription')),
  document_hash   TEXT NOT NULL,
  avg_duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  p99_duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  call_count      BIGINT NOT NULL DEFAULT 0,
  error_count     BIGINT NOT NULL DEFAULT 0,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_graphql_cache_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  type_name       TEXT NOT NULL,
  field_name      TEXT,
  max_age_seconds INTEGER NOT NULL DEFAULT 60,
  scope           TEXT NOT NULL DEFAULT 'public' CHECK (scope IN ('public','private','no-cache')),
  stale_ttl       INTEGER NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  hit_count       BIGINT NOT NULL DEFAULT 0,
  miss_count      BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_graphql_schemas_agent ON agent_graphql_schemas(agent_id);
CREATE INDEX idx_graphql_schemas_service ON agent_graphql_schemas(service_name);
CREATE INDEX idx_graphql_operations_agent ON agent_graphql_operations(agent_id);
CREATE INDEX idx_graphql_operations_hash ON agent_graphql_operations(document_hash);
CREATE INDEX idx_graphql_cache_agent ON agent_graphql_cache_rules(agent_id);

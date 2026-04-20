-- Batch 85: Agent Dependency Injection
-- DI container, service bindings, scopes, and lifecycle management

CREATE TABLE IF NOT EXISTS di_containers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES di_containers(id),
  scope TEXT NOT NULL DEFAULT 'singleton' CHECK (scope IN ('singleton','transient','scoped','request','session')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','disposed')),
  binding_count INTEGER NOT NULL DEFAULT 0,
  resolution_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS di_bindings (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES di_containers(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  binding_type TEXT NOT NULL CHECK (binding_type IN ('class','factory','value','alias','provider','async_factory')),
  implementation TEXT,
  scope TEXT NOT NULL DEFAULT 'singleton' CHECK (scope IN ('singleton','transient','scoped','request','session')),
  is_optional BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(container_id, token)
);

CREATE TABLE IF NOT EXISTS di_resolutions (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES di_containers(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL REFERENCES di_bindings(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  resolution_time_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS di_interceptors (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES di_containers(id) ON DELETE CASCADE,
  token_pattern TEXT NOT NULL,
  interceptor_type TEXT NOT NULL CHECK (interceptor_type IN ('before_resolve','after_resolve','on_dispose','on_error','middleware')),
  handler TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invocation_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS di_lifecycle_events (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL REFERENCES di_containers(id) ON DELETE CASCADE,
  binding_id TEXT REFERENCES di_bindings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','resolved','cached','disposed','error','intercepted','migrated')),
  token TEXT,
  duration_ms NUMERIC(10,3),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_di_containers_parent ON di_containers(parent_id);
CREATE INDEX idx_di_containers_scope ON di_containers(scope);
CREATE INDEX idx_di_containers_status ON di_containers(status);
CREATE INDEX idx_di_containers_name ON di_containers(name);
CREATE INDEX idx_di_bindings_container ON di_bindings(container_id);
CREATE INDEX idx_di_bindings_token ON di_bindings(token);
CREATE INDEX idx_di_bindings_type ON di_bindings(binding_type);
CREATE INDEX idx_di_bindings_scope ON di_bindings(scope);
CREATE INDEX idx_di_bindings_tags ON di_bindings USING GIN(tags);
CREATE INDEX idx_di_resolutions_container ON di_resolutions(container_id);
CREATE INDEX idx_di_resolutions_binding ON di_resolutions(binding_id);
CREATE INDEX idx_di_resolutions_token ON di_resolutions(token);
CREATE INDEX idx_di_resolutions_created ON di_resolutions(created_at DESC);
CREATE INDEX idx_di_interceptors_container ON di_interceptors(container_id);
CREATE INDEX idx_di_interceptors_type ON di_interceptors(interceptor_type);
CREATE INDEX idx_di_interceptors_active ON di_interceptors(is_active) WHERE is_active = true;
CREATE INDEX idx_di_interceptors_priority ON di_interceptors(container_id, priority DESC);
CREATE INDEX idx_di_lifecycle_container ON di_lifecycle_events(container_id);
CREATE INDEX idx_di_lifecycle_type ON di_lifecycle_events(event_type);
CREATE INDEX idx_di_lifecycle_created ON di_lifecycle_events(created_at DESC);

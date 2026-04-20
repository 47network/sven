-- Batch 95: Agent Schema Registry
-- Centralized schema registry for agent data contracts

CREATE TABLE IF NOT EXISTS schema_registry (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  schema_format TEXT NOT NULL DEFAULT 'json_schema' CHECK (schema_format IN ('json_schema','avro','protobuf','openapi','graphql','custom')),
  definition JSONB NOT NULL DEFAULT '{}',
  compatibility TEXT NOT NULL DEFAULT 'backward' CHECK (compatibility IN ('backward','forward','full','none')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','archived','draft')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(namespace, name, version)
);

CREATE TABLE IF NOT EXISTS schema_versions (
  id TEXT PRIMARY KEY,
  registry_id TEXT NOT NULL REFERENCES schema_registry(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}',
  changelog TEXT,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  published_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_dependencies (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schema_registry(id) ON DELETE CASCADE,
  depends_on TEXT NOT NULL REFERENCES schema_registry(id),
  dependency_type TEXT NOT NULL DEFAULT 'required' CHECK (dependency_type IN ('required','optional','dev')),
  version_constraint TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_consumers (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schema_registry(id) ON DELETE CASCADE,
  consumer_id TEXT NOT NULL,
  consumer_type TEXT NOT NULL DEFAULT 'agent' CHECK (consumer_type IN ('agent','service','pipeline','external')),
  subscribed_version TEXT,
  last_used_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_evolution_log (
  id TEXT PRIMARY KEY,
  schema_id TEXT NOT NULL REFERENCES schema_registry(id),
  from_version TEXT,
  to_version TEXT NOT NULL,
  evolution_type TEXT NOT NULL CHECK (evolution_type IN ('create','update','deprecate','archive','restore','fork')),
  changes JSONB DEFAULT '[]',
  impact_assessment TEXT,
  approved_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sr_namespace ON schema_registry(namespace);
CREATE INDEX idx_sr_name ON schema_registry(name);
CREATE INDEX idx_sr_format ON schema_registry(schema_format);
CREATE INDEX idx_sr_status ON schema_registry(status);
CREATE INDEX idx_sv_registry ON schema_versions(registry_id);
CREATE INDEX idx_sv_version ON schema_versions(version);
CREATE INDEX idx_sv_breaking ON schema_versions(is_breaking) WHERE is_breaking = true;
CREATE INDEX idx_sv_created ON schema_versions(created_at DESC);
CREATE INDEX idx_sd_schema ON schema_dependencies(schema_id);
CREATE INDEX idx_sd_depends ON schema_dependencies(depends_on);
CREATE INDEX idx_sd_type ON schema_dependencies(dependency_type);
CREATE INDEX idx_sd_created ON schema_dependencies(created_at DESC);
CREATE INDEX idx_sc_schema ON schema_consumers(schema_id);
CREATE INDEX idx_sc_consumer ON schema_consumers(consumer_id);
CREATE INDEX idx_sc_type ON schema_consumers(consumer_type);
CREATE INDEX idx_sc_status ON schema_consumers(status);
CREATE INDEX idx_sel_schema ON schema_evolution_log(schema_id);
CREATE INDEX idx_sel_type ON schema_evolution_log(evolution_type);
CREATE INDEX idx_sel_from ON schema_evolution_log(from_version);
CREATE INDEX idx_sel_created ON schema_evolution_log(created_at DESC);

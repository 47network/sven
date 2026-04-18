-- Batch 109 — Agent API Versioning
-- Version policies, deprecation schedules, compatibility checks

CREATE TABLE IF NOT EXISTS agent_api_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  version_label VARCHAR(50) NOT NULL,
  semver VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  published_at TIMESTAMPTZ,
  sunset_at TIMESTAMPTZ,
  changelog_url TEXT,
  consumers_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_api_deprecations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  version_id UUID NOT NULL REFERENCES agent_api_versions(id) ON DELETE CASCADE,
  endpoint_path VARCHAR(500) NOT NULL,
  deprecated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sunset_date TIMESTAMPTZ NOT NULL,
  replacement_path VARCHAR(500),
  migration_guide_url TEXT,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_api_compat_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  source_version_id UUID NOT NULL REFERENCES agent_api_versions(id) ON DELETE CASCADE,
  target_version_id UUID NOT NULL REFERENCES agent_api_versions(id) ON DELETE CASCADE,
  is_compatible BOOLEAN NOT NULL DEFAULT true,
  breaking_changes_count INT NOT NULL DEFAULT 0,
  additions_count INT NOT NULL DEFAULT 0,
  removals_count INT NOT NULL DEFAULT 0,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_versions_agent ON agent_api_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_service ON agent_api_versions(service_name);
CREATE INDEX IF NOT EXISTS idx_api_deprecations_version ON agent_api_deprecations(version_id);
CREATE INDEX IF NOT EXISTS idx_api_deprecations_sunset ON agent_api_deprecations(sunset_date);
CREATE INDEX IF NOT EXISTS idx_api_compat_source ON agent_api_compat_checks(source_version_id);

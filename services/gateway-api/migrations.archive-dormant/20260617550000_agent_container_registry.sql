-- Batch 118 — Container Registry
-- Manages private container image registries for agent workloads

CREATE TABLE IF NOT EXISTS agent_container_registries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'token' CHECK (auth_type IN ('token','basic','iam','oidc')),
  storage_backend TEXT NOT NULL DEFAULT 'local' CHECK (storage_backend IN ('local','s3','gcs','azure_blob')),
  max_images INT NOT NULL DEFAULT 500,
  max_storage_bytes BIGINT NOT NULL DEFAULT 53687091200,
  tls_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_container_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES agent_container_registries(id) ON DELETE CASCADE,
  repository TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'latest',
  digest TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  architecture TEXT NOT NULL DEFAULT 'amd64' CHECK (architecture IN ('amd64','arm64','multi')),
  os TEXT NOT NULL DEFAULT 'linux',
  pushed_by UUID,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_pulled_at TIMESTAMPTZ,
  pull_count INT NOT NULL DEFAULT 0,
  labels JSONB NOT NULL DEFAULT '{}',
  UNIQUE(registry_id, repository, tag)
);

CREATE TABLE IF NOT EXISTS agent_image_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES agent_container_images(id) ON DELETE CASCADE,
  cve_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','negligible')),
  package_name TEXT NOT NULL,
  installed_version TEXT NOT NULL,
  fixed_version TEXT,
  description TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_container_registries_agent ON agent_container_registries(agent_id);
CREATE INDEX idx_container_images_registry ON agent_container_images(registry_id);
CREATE INDEX idx_container_images_repo ON agent_container_images(repository);
CREATE INDEX idx_container_images_digest ON agent_container_images(digest);
CREATE INDEX idx_image_vulns_image ON agent_image_vulnerabilities(image_id);
CREATE INDEX idx_image_vulns_severity ON agent_image_vulnerabilities(severity);

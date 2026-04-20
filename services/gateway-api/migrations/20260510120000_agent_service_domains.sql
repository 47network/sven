-- Batch 37: Agent Service Domains — agents spawn independent service businesses
-- Each agent can create a service at {subdomain}.from.sven.systems

-- ── Service templates (pre-built blueprints) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS service_templates (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT NOT NULL DEFAULT '',
  service_type   TEXT NOT NULL CHECK (service_type IN (
    'research_lab', 'consulting', 'design_studio', 'translation_bureau',
    'writing_house', 'data_analytics', 'dev_shop', 'marketing_agency',
    'legal_office', 'education_center', 'custom'
  )),
  default_config JSONB NOT NULL DEFAULT '{}',
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  base_cost_tokens INTEGER NOT NULL DEFAULT 100,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Agent service domains ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_service_domains (
  id             TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agent_profiles(id),
  subdomain      TEXT NOT NULL UNIQUE,
  display_name   TEXT NOT NULL,
  service_type   TEXT NOT NULL CHECK (service_type IN (
    'research_lab', 'consulting', 'design_studio', 'translation_bureau',
    'writing_house', 'data_analytics', 'dev_shop', 'marketing_agency',
    'legal_office', 'education_center', 'custom'
  )),
  template_id    TEXT REFERENCES service_templates(id),
  status         TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN (
    'provisioning', 'active', 'suspended', 'archived'
  )),
  config         JSONB NOT NULL DEFAULT '{}',
  branding       JSONB NOT NULL DEFAULT '{}',
  revenue_total  NUMERIC(14,2) NOT NULL DEFAULT 0,
  visitor_count  INTEGER NOT NULL DEFAULT 0,
  tokens_invested INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_service_domains_agent ON agent_service_domains(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_service_domains_status ON agent_service_domains(status);

-- ── Service deployments (infra state per domain) ──────────────────────────────
CREATE TABLE IF NOT EXISTS service_deployments (
  id             TEXT PRIMARY KEY,
  domain_id      TEXT NOT NULL REFERENCES agent_service_domains(id),
  version        INTEGER NOT NULL DEFAULT 1,
  deploy_status  TEXT NOT NULL DEFAULT 'pending' CHECK (deploy_status IN (
    'pending', 'building', 'deploying', 'live', 'failed', 'rolled_back'
  )),
  container_id   TEXT,
  port           INTEGER,
  health_url     TEXT,
  last_health    TEXT CHECK (last_health IN ('healthy', 'degraded', 'down', NULL)),
  build_log      TEXT,
  deployed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_deployments_domain ON service_deployments(domain_id);

-- ── Service analytics (daily rollup) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_domain_analytics (
  id             TEXT PRIMARY KEY,
  domain_id      TEXT NOT NULL REFERENCES agent_service_domains(id),
  day            DATE NOT NULL,
  page_views     INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  orders_count   INTEGER NOT NULL DEFAULT 0,
  revenue_usd    NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_response_ms INTEGER,
  error_count    INTEGER NOT NULL DEFAULT 0,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain_id, day)
);

CREATE INDEX IF NOT EXISTS idx_sda_domain_day ON service_domain_analytics(domain_id, day);

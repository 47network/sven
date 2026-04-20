-- Batch 39 — Integration Agents Agency
-- Agents that wrap third-party SaaS platforms (Atlassian, Salesforce, HubSpot, etc.)
-- and sell their use on the marketplace. Self-evolving: auto-detect API changes,
-- fix breaking updates, improve capabilities over time.

CREATE TABLE IF NOT EXISTS integration_platforms (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL CHECK (category IN (
    'project_management', 'crm', 'marketing', 'support',
    'hr', 'finance', 'devops', 'communication',
    'analytics', 'ecommerce', 'design', 'legal', 'custom'
  )),
  website_url   TEXT,
  api_docs_url  TEXT,
  auth_type     TEXT NOT NULL CHECK (auth_type IN (
    'oauth2', 'api_key', 'basic', 'token', 'webhook', 'saml', 'custom'
  )),
  api_version   TEXT,
  status        TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'analyzing', 'building', 'testing', 'active',
    'deprecated', 'broken', 'archived'
  )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_agents (
  id               TEXT PRIMARY KEY,
  platform_id      TEXT NOT NULL REFERENCES integration_platforms(id),
  agent_id         TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  capabilities     JSONB NOT NULL DEFAULT '[]',
  supported_actions JSONB NOT NULL DEFAULT '[]',
  api_coverage_pct  NUMERIC(5,2) DEFAULT 0,
  health_status    TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN (
    'healthy', 'degraded', 'broken', 'updating', 'learning'
  )),
  version          TEXT NOT NULL DEFAULT '0.1.0',
  total_invocations BIGINT NOT NULL DEFAULT 0,
  success_rate      NUMERIC(5,2) DEFAULT 100,
  revenue_tokens    BIGINT NOT NULL DEFAULT 0,
  last_health_check TIMESTAMPTZ,
  last_api_sync     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_evolutions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES integration_agents(id),
  evolution_type  TEXT NOT NULL CHECK (evolution_type IN (
    'api_change_detected', 'skill_learned', 'bug_fixed',
    'capability_added', 'performance_improved', 'breaking_change_resolved',
    'new_endpoint_covered', 'auth_updated', 'deprecation_handled'
  )),
  description     TEXT NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  auto_resolved   BOOLEAN NOT NULL DEFAULT false,
  resolution_ms   BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_subscriptions (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES integration_agents(id),
  subscriber_id   TEXT NOT NULL,
  plan            TEXT NOT NULL CHECK (plan IN (
    'free_trial', 'basic', 'pro', 'enterprise', 'custom'
  )),
  monthly_tokens  BIGINT NOT NULL DEFAULT 0,
  invocations_used BIGINT NOT NULL DEFAULT 0,
  invocations_limit BIGINT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'cancelled', 'expired'
  )),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_agents_platform ON integration_agents(platform_id);
CREATE INDEX idx_integration_agents_health ON integration_agents(health_status);
CREATE INDEX idx_integration_evolutions_agent ON integration_evolutions(agent_id);
CREATE INDEX idx_integration_evolutions_type ON integration_evolutions(evolution_type);
CREATE INDEX idx_integration_subscriptions_agent ON integration_subscriptions(agent_id);
CREATE INDEX idx_integration_subscriptions_status ON integration_subscriptions(status);

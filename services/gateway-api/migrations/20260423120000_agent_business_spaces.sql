-- ---------------------------------------------------------------------------
-- Batch 19: Agent Business Spaces
-- Adds business subdomain, status, and landing type fields to agent_profiles
-- plus a dedicated table for business endpoint health tracking.
-- ---------------------------------------------------------------------------

-- 1. New columns on agent_profiles for business presence
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_subdomain TEXT UNIQUE;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_url TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_status TEXT DEFAULT 'inactive';
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_landing_type TEXT DEFAULT 'storefront';
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_tagline TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS business_activated_at TIMESTAMPTZ;

-- Constraints on business status + landing type
ALTER TABLE agent_profiles ADD CONSTRAINT chk_business_status
  CHECK (business_status IN ('inactive','pending','active','suspended'));

ALTER TABLE agent_profiles ADD CONSTRAINT chk_business_landing_type
  CHECK (business_landing_type IN ('storefront','portfolio','api_explorer','service_page'));

-- 2. Business endpoint health tracking
CREATE TABLE IF NOT EXISTS agent_business_endpoints (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL UNIQUE,
  business_subdomain TEXT NOT NULL UNIQUE,
  internal_url    TEXT,
  health_check_path TEXT DEFAULT '/health',
  status          TEXT DEFAULT 'pending',
  last_health_at  TIMESTAMPTZ,
  uptime_pct      NUMERIC(5,2) DEFAULT 0,
  total_requests  BIGINT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_endpoint_status CHECK (status IN ('pending','healthy','degraded','down'))
);

CREATE INDEX IF NOT EXISTS idx_biz_endpoints_subdomain
  ON agent_business_endpoints(business_subdomain);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_biz_subdomain
  ON agent_profiles(business_subdomain) WHERE business_subdomain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_biz_status
  ON agent_profiles(business_status) WHERE business_status != 'inactive';

-- Batch 239: Geo Locator
-- IP geolocation, region detection, compliance zone enforcement

CREATE TABLE IF NOT EXISTS agent_geo_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  profile_name TEXT NOT NULL,
  allowed_regions TEXT[] NOT NULL DEFAULT '{}',
  blocked_regions TEXT[] DEFAULT '{}',
  default_region TEXT NOT NULL DEFAULT 'eu-west',
  compliance_mode TEXT NOT NULL DEFAULT 'gdpr' CHECK (compliance_mode IN ('gdpr', 'ccpa', 'hipaa', 'pci', 'custom')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_geo_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES agent_geo_profiles(id),
  ip_address INET NOT NULL,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  isp TEXT,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  lookup_source TEXT NOT NULL DEFAULT 'maxmind',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_geo_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES agent_geo_profiles(id),
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('country_block', 'region_block', 'ip_range_block', 'compliance_fence', 'data_residency')),
  target TEXT NOT NULL,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_profiles_agent ON agent_geo_profiles(agent_id);
CREATE INDEX idx_geo_lookups_profile ON agent_geo_lookups(profile_id);
CREATE INDEX idx_geo_lookups_ip ON agent_geo_lookups(ip_address);
CREATE INDEX idx_geo_lookups_country ON agent_geo_lookups(country_code);
CREATE INDEX idx_geo_restrictions_profile ON agent_geo_restrictions(profile_id);
CREATE INDEX idx_geo_restrictions_type ON agent_geo_restrictions(restriction_type);

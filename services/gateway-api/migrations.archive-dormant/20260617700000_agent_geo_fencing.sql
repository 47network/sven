-- Batch 133 — Agent Geo-Fencing
-- Migration: 20260617700000_agent_geo_fencing.sql

BEGIN;

CREATE TABLE IF NOT EXISTS geo_fence_zones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  fence_type      TEXT NOT NULL CHECK (fence_type IN ('circle','polygon','rectangle','country','region')),
  coordinates     JSONB NOT NULL DEFAULT '[]',
  radius_km       NUMERIC,
  country_code    TEXT,
  region_code     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geo_fence_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id         UUID NOT NULL REFERENCES geo_fence_zones(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL CHECK (rule_type IN ('allow','deny','alert','throttle','redirect')),
  target_service  TEXT,
  priority        INTEGER NOT NULL DEFAULT 0,
  conditions      JSONB NOT NULL DEFAULT '{}',
  action_config   JSONB NOT NULL DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geo_fence_alerts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id         UUID NOT NULL REFERENCES geo_fence_zones(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES geo_fence_rules(id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('entry','exit','dwell','violation','anomaly')),
  source_ip       TEXT,
  source_location JSONB,
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_fence_zones_type ON geo_fence_zones(fence_type);
CREATE INDEX IF NOT EXISTS idx_geo_fence_zones_active ON geo_fence_zones(active);
CREATE INDEX IF NOT EXISTS idx_geo_fence_rules_zone ON geo_fence_rules(zone_id);
CREATE INDEX IF NOT EXISTS idx_geo_fence_rules_type ON geo_fence_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_geo_fence_alerts_zone ON geo_fence_alerts(zone_id);
CREATE INDEX IF NOT EXISTS idx_geo_fence_alerts_type ON geo_fence_alerts(alert_type);

COMMIT;

-- Batch 137 — Agent Asset Management
BEGIN;

CREATE TABLE IF NOT EXISTS digital_assets (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('code','document','image','model','dataset','template','plugin','certificate','key')),
  lifecycle       TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft','active','deprecated','archived','deleted')),
  owner_id        UUID,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  file_path       TEXT,
  file_size       BIGINT,
  checksum        TEXT,
  mime_type       TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_transfers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id        UUID NOT NULL REFERENCES digital_assets(id) ON DELETE CASCADE,
  from_owner      UUID,
  to_owner        UUID NOT NULL,
  transfer_type   TEXT NOT NULL CHECK (transfer_type IN ('assign','share','revoke','clone','migrate')),
  reason          TEXT,
  approved_by     UUID,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','completed','rejected','cancelled')),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_licenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id        UUID NOT NULL REFERENCES digital_assets(id) ON DELETE CASCADE,
  license_type    TEXT NOT NULL CHECK (license_type IN ('mit','apache2','gpl3','proprietary','creative_commons','custom')),
  licensee_id     UUID,
  granted_by      UUID,
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  restrictions    TEXT[] NOT NULL DEFAULT '{}',
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ,
  revoked         BOOLEAN NOT NULL DEFAULT false,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_assets_category ON digital_assets(category);
CREATE INDEX IF NOT EXISTS idx_digital_assets_lifecycle ON digital_assets(lifecycle);
CREATE INDEX IF NOT EXISTS idx_digital_assets_owner ON digital_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_asset ON asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_transfers_status ON asset_transfers(status);
CREATE INDEX IF NOT EXISTS idx_asset_licenses_asset ON asset_licenses(asset_id);

COMMIT;

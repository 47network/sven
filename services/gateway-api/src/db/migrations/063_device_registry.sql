-- Sprint 16 · Pillar 3 — Device registry for Magic Mirror / external devices
--
-- Stores paired devices (mirrors, kiosks, sensor hubs) with capabilities,
-- status, and API key authentication.

CREATE TABLE IF NOT EXISTS devices (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,                                 -- "Kitchen Mirror", "Office Pi"
  device_type      TEXT NOT NULL DEFAULT 'mirror',                -- mirror, tablet, kiosk, sensor_hub
  status           TEXT NOT NULL DEFAULT 'offline',               -- online, offline, pairing
  capabilities     JSONB NOT NULL DEFAULT '[]'::jsonb,            -- ['display','camera','touch','speaker','mic','gpio']
  config           JSONB NOT NULL DEFAULT '{}'::jsonb,            -- device-specific config (resolution, orientation, zones…)
  last_seen_at     TIMESTAMPTZ,
  paired_at        TIMESTAMPTZ,
  api_key_hash     TEXT,                                          -- bcrypt hash of device API key (set on pairing)
  pairing_code     TEXT,                                          -- temporary 6-char code during pairing
  pairing_expires  TIMESTAMPTZ,                                   -- when the pairing code expires
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- Events emitted by devices (presence, touch, sensor readings, errors)
CREATE TABLE IF NOT EXISTS device_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,           -- 'presence_detected','touch','gesture','sensor_reading','error','boot'
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_events_device ON device_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type, created_at DESC);

-- Commands sent TO devices (display content, camera capture, TTS, etc.)
CREATE TABLE IF NOT EXISTS device_commands (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command     TEXT NOT NULL,           -- 'display','camera_snapshot','tts_speak','reboot','update_config'
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending, delivered, acknowledged, failed
  sent_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  ack_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status) WHERE status = 'pending';

-- Batch 423: Certificate Rotator
CREATE TABLE IF NOT EXISTS agent_cert_rotator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  check_interval_hours INTEGER NOT NULL DEFAULT 24,
  renewal_threshold_days INTEGER NOT NULL DEFAULT 30,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  notification_channels TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_cert_rotator_configs(id),
  domain TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT 'letsencrypt',
  serial_number TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expiring','expired','revoked','pending')),
  certificate_pem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cert_rotation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_certificates(id),
  action TEXT NOT NULL CHECK (action IN ('issued','renewed','revoked','expired','check')),
  old_serial TEXT,
  new_serial TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_cert_rotator_configs_agent ON agent_cert_rotator_configs(agent_id);
CREATE INDEX idx_agent_certificates_config ON agent_certificates(config_id);
CREATE INDEX idx_agent_certificates_expires ON agent_certificates(expires_at);

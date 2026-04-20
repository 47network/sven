CREATE TABLE IF NOT EXISTS agent_certificate_rotator_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rotation_strategy TEXT NOT NULL DEFAULT 'automatic',
  renewal_days_before INTEGER NOT NULL DEFAULT 30,
  cert_authority TEXT NOT NULL DEFAULT 'lets_encrypt',
  key_type TEXT NOT NULL DEFAULT 'ecdsa_p256',
  backup_enabled BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_certificate_rotator_configs(id),
  agent_id UUID NOT NULL,
  domain TEXT NOT NULL,
  cert_type TEXT NOT NULL DEFAULT 'tls',
  issuer TEXT,
  serial_number TEXT,
  fingerprint TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cert_rotation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_certificates(id),
  rotation_type TEXT NOT NULL,
  old_fingerprint TEXT,
  new_fingerprint TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  error_message TEXT,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certificates_agent ON agent_certificates(agent_id);
CREATE INDEX IF NOT EXISTS idx_certificates_expires ON agent_certificates(expires_at);
CREATE INDEX IF NOT EXISTS idx_cert_rotation_cert ON agent_cert_rotation_logs(cert_id);

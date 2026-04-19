-- Batch 238: Certificate Authority
-- Manages SSL/TLS certificates, CA operations, certificate lifecycle

CREATE TABLE IF NOT EXISTS agent_certificate_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  domain TEXT NOT NULL,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('ssl_tls', 'code_signing', 'client_auth', 'email', 'wildcard')),
  issuer TEXT NOT NULL DEFAULT 'internal',
  validity_days INTEGER NOT NULL DEFAULT 365,
  key_algorithm TEXT NOT NULL DEFAULT 'ecdsa_p256',
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_issued_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_certificate_configs(id),
  serial_number TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  san TEXT[] DEFAULT '{}',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_certificate_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES agent_issued_certificates(id),
  action TEXT NOT NULL CHECK (action IN ('issued', 'renewed', 'revoked', 'verified', 'expired', 'rotated')),
  performed_by UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cert_configs_agent ON agent_certificate_configs(agent_id);
CREATE INDEX idx_cert_configs_domain ON agent_certificate_configs(domain);
CREATE INDEX idx_issued_certs_config ON agent_issued_certificates(config_id);
CREATE INDEX idx_issued_certs_status ON agent_issued_certificates(status);
CREATE INDEX idx_issued_certs_expires ON agent_issued_certificates(expires_at);
CREATE INDEX idx_cert_audits_cert ON agent_certificate_audits(certificate_id);
CREATE INDEX idx_cert_audits_action ON agent_certificate_audits(action);

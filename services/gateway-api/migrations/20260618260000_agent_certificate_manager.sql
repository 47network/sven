-- Batch 189: Certificate Manager — TLS/SSL certificate lifecycle
BEGIN;

CREATE TABLE IF NOT EXISTS agent_certificate_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  ca_type VARCHAR(50) NOT NULL CHECK (ca_type IN ('root','intermediate','external','acme','self_signed')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','pending','suspended')),
  issuer VARCHAR(500),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  key_algorithm VARCHAR(50) DEFAULT 'rsa-2048' CHECK (key_algorithm IN ('rsa-2048','rsa-4096','ecdsa-256','ecdsa-384','ed25519')),
  certificates_issued INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ca_id UUID NOT NULL REFERENCES agent_certificate_authorities(id) ON DELETE CASCADE,
  common_name VARCHAR(500) NOT NULL,
  cert_type VARCHAR(50) NOT NULL CHECK (cert_type IN ('server','client','wildcard','code_signing','email','mutual_tls')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','pending_renewal','suspended')),
  serial_number VARCHAR(100),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  renewal_days_before INT DEFAULT 30,
  domain_names TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_certificate_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES agent_certificates(id) ON DELETE CASCADE,
  old_serial VARCHAR(100),
  new_serial VARCHAR(100),
  renewal_type VARCHAR(50) NOT NULL CHECK (renewal_type IN ('auto','manual','emergency','upgrade','reissue')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  initiated_by UUID,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_certificate_authorities_agent ON agent_certificate_authorities(agent_id);
CREATE INDEX idx_agent_certificates_ca ON agent_certificates(ca_id);
CREATE INDEX idx_agent_certificate_renewals_cert ON agent_certificate_renewals(certificate_id);
CREATE INDEX idx_agent_certificates_status ON agent_certificates(status);
CREATE INDEX idx_agent_certificates_valid_until ON agent_certificates(valid_until);

COMMIT;

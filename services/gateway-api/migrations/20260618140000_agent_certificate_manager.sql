-- Batch 177: Agent Certificate Manager
-- Manages TLS/SSL certificates, auto-renewal, CA trust chains,
-- certificate monitoring, and expiry alerting

CREATE TABLE IF NOT EXISTS agent_certificate_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  cert_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  cert_type TEXT NOT NULL CHECK (cert_type IN ('tls_server','tls_client','code_signing','s_mime','ca_intermediate','self_signed','wildcard','san')),
  issuer TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  fingerprint_sha256 TEXT NOT NULL,
  subject_cn TEXT NOT NULL,
  san_domains TEXT[] DEFAULT '{}',
  key_algorithm TEXT NOT NULL DEFAULT 'rsa2048' CHECK (key_algorithm IN ('rsa2048','rsa4096','ec256','ec384','ed25519')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  renew_days_before INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expiring','expired','revoked','pending','renewal_failed')),
  private_key_ref TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_certificate_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_certificate_inventory(id),
  renewal_type TEXT NOT NULL CHECK (renewal_type IN ('auto_acme','manual','csr_request','self_sign','ca_signed')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','requesting','validating','issued','failed','cancelled')),
  acme_provider TEXT,
  challenge_type TEXT CHECK (challenge_type IN ('http01','dns01','tls_alpn01')),
  old_serial TEXT,
  new_serial TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_certificate_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_certificate_inventory(id),
  check_type TEXT NOT NULL CHECK (check_type IN ('expiry','revocation','chain_validity','key_strength','ct_log','transparency')),
  last_check_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ NOT NULL,
  check_interval_hours INTEGER NOT NULL DEFAULT 24,
  last_status TEXT NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('healthy','warning','critical','unknown','error')),
  alert_sent BOOLEAN NOT NULL DEFAULT false,
  findings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cert_inventory_agent ON agent_certificate_inventory(agent_id);
CREATE INDEX idx_cert_inventory_expires ON agent_certificate_inventory(expires_at);
CREATE INDEX idx_cert_inventory_status ON agent_certificate_inventory(status);
CREATE INDEX idx_cert_renewals_cert ON agent_certificate_renewals(cert_id);
CREATE INDEX idx_cert_monitors_next ON agent_certificate_monitors(next_check_at);

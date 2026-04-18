-- Batch 100: Agent SSL Certificates
CREATE TABLE IF NOT EXISTS agent_ssl_certificates (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT 'letsencrypt',
  cert_type TEXT NOT NULL DEFAULT 'dv',
  fingerprint TEXT,
  serial_number TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ssl_renewal_log (
  id TEXT PRIMARY KEY,
  cert_id TEXT NOT NULL REFERENCES agent_ssl_certificates(id),
  renewal_type TEXT NOT NULL DEFAULT 'automatic',
  old_fingerprint TEXT,
  new_fingerprint TEXT,
  old_expiry TIMESTAMPTZ,
  new_expiry TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ssl_alerts (
  id TEXT PRIMARY KEY,
  cert_id TEXT NOT NULL REFERENCES agent_ssl_certificates(id),
  alert_type TEXT NOT NULL DEFAULT 'expiry_warning',
  days_until_expiry INTEGER,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ssl_certs_agent ON agent_ssl_certificates(agent_id);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_domain ON agent_ssl_certificates(domain);
CREATE INDEX IF NOT EXISTS idx_ssl_certs_expires ON agent_ssl_certificates(expires_at);
CREATE INDEX IF NOT EXISTS idx_ssl_renewals_cert ON agent_ssl_renewal_log(cert_id);
CREATE INDEX IF NOT EXISTS idx_ssl_alerts_cert ON agent_ssl_alerts(cert_id);

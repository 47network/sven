-- Batch 218: SSL Manager
-- Agent-managed SSL/TLS certificate lifecycle

CREATE TABLE IF NOT EXISTS agent_ssl_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  domain TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT 'letsencrypt',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issued','active','expiring','expired','revoked')),
  certificate_type TEXT NOT NULL DEFAULT 'dv' CHECK (certificate_type IN ('dv','ov','ev','wildcard','san')),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_ssl_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES agent_ssl_certificates(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_ssl_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  domain TEXT NOT NULL,
  grade TEXT CHECK (grade IN ('A+','A','B','C','D','F')),
  vulnerabilities JSONB DEFAULT '[]',
  protocol_support JSONB DEFAULT '{}',
  cipher_suites JSONB DEFAULT '[]',
  audited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ssl_certificates_agent ON agent_ssl_certificates(agent_id);
CREATE INDEX idx_ssl_certificates_domain ON agent_ssl_certificates(domain);
CREATE INDEX idx_ssl_certificates_status ON agent_ssl_certificates(status);
CREATE INDEX idx_ssl_renewals_cert ON agent_ssl_renewals(certificate_id);
CREATE INDEX idx_ssl_audits_agent ON agent_ssl_audits(agent_id);

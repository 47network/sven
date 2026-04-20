CREATE TABLE IF NOT EXISTS agent_tls_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  domain TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT 'letsencrypt',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issued','expired','revoked','failed')),
  cert_type TEXT NOT NULL DEFAULT 'dv' CHECK (cert_type IN ('dv','ov','ev','self_signed','wildcard')),
  not_before TIMESTAMPTZ,
  not_after TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  key_algorithm TEXT NOT NULL DEFAULT 'ecdsa_p256',
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cert_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_tls_certificates(id),
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('http01','dns01','tls_alpn01')),
  token TEXT NOT NULL,
  key_authorization TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','valid','invalid')),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_cert_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id UUID NOT NULL REFERENCES agent_tls_certificates(id),
  target_service TEXT NOT NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','failed','replaced')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_certs_agent ON agent_tls_certificates(agent_id);
CREATE INDEX idx_certs_domain ON agent_tls_certificates(domain);
CREATE INDEX idx_certs_status ON agent_tls_certificates(status);
CREATE INDEX idx_certs_expiry ON agent_tls_certificates(not_after);
CREATE INDEX idx_challenges_cert ON agent_cert_challenges(cert_id);
CREATE INDEX idx_deployments_cert ON agent_cert_deployments(cert_id);

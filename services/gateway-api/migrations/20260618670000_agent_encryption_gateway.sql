-- Batch 230: Encryption Gateway
-- Manages encryption operations, key distribution, and secure channels

CREATE TABLE IF NOT EXISTS agent_encryption_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  encryption_type VARCHAR(64) NOT NULL CHECK (encryption_type IN ('aes256', 'rsa4096', 'chacha20', 'tls13', 'e2e')),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  endpoint_a VARCHAR(255) NOT NULL,
  endpoint_b VARCHAR(255) NOT NULL,
  key_exchange_method VARCHAR(64) NOT NULL DEFAULT 'ecdh',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_encryption_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES agent_encryption_channels(id),
  agent_id UUID NOT NULL,
  operation_type VARCHAR(32) NOT NULL CHECK (operation_type IN ('encrypt', 'decrypt', 'sign', 'verify', 'seal', 'unseal')),
  data_size_bytes BIGINT NOT NULL DEFAULT 0,
  algorithm VARCHAR(64) NOT NULL,
  duration_ms INTEGER,
  status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_certificate_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  cert_type VARCHAR(64) NOT NULL CHECK (cert_type IN ('root_ca', 'intermediate', 'leaf', 'self_signed', 'client')),
  subject VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  serial_number VARCHAR(255),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  fingerprint VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expired', 'revoked', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_encryption_channels_agent ON agent_encryption_channels(agent_id);
CREATE INDEX idx_encryption_operations_channel ON agent_encryption_operations(channel_id);
CREATE INDEX idx_encryption_operations_agent ON agent_encryption_operations(agent_id);
CREATE INDEX idx_certificate_store_agent ON agent_certificate_store(agent_id);
CREATE INDEX idx_certificate_store_fingerprint ON agent_certificate_store(fingerprint);

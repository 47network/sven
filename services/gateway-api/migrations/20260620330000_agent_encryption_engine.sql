-- Batch 396: Encryption Engine
CREATE TABLE IF NOT EXISTS agent_encryption_engine_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  default_algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_derivation TEXT NOT NULL DEFAULT 'pbkdf2' CHECK (key_derivation IN ('pbkdf2', 'scrypt', 'argon2', 'hkdf')),
  key_length INTEGER NOT NULL DEFAULT 256,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_encryption_engine_configs(id),
  name TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  key_material TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'encrypt' CHECK (purpose IN ('encrypt', 'sign', 'wrap', 'derive')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_encryption_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES agent_encryption_engine_configs(id),
  key_id UUID REFERENCES agent_encryption_keys(id),
  operation TEXT NOT NULL CHECK (operation IN ('encrypt', 'decrypt', 'sign', 'verify', 'hash')),
  algorithm TEXT NOT NULL,
  input_size INTEGER,
  output_size INTEGER,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_encryption_keys_config ON agent_encryption_keys(config_id);
CREATE INDEX idx_encryption_ops_config ON agent_encryption_operations(config_id);

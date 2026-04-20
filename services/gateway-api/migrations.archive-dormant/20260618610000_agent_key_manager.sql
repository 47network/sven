-- Batch 224: Key Manager
CREATE TABLE IF NOT EXISTS agent_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  key_alias TEXT NOT NULL,
  algorithm TEXT NOT NULL CHECK (algorithm IN ('aes-256-gcm','rsa-4096','ed25519','x25519','chacha20')),
  key_type TEXT NOT NULL CHECK (key_type IN ('symmetric','asymmetric','signing','exchange')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotated','revoked','expired')),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_key_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES agent_encryption_keys(id),
  old_version INT NOT NULL,
  new_version INT NOT NULL,
  reason TEXT,
  rotated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES agent_encryption_keys(id),
  operation TEXT NOT NULL CHECK (operation IN ('encrypt','decrypt','sign','verify','wrap','unwrap')),
  requester_id UUID,
  success BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_encryption_keys_agent ON agent_encryption_keys(agent_id);
CREATE INDEX idx_key_rotations_key ON agent_key_rotations(key_id);
CREATE INDEX idx_key_usage_key ON agent_key_usage_logs(key_id);

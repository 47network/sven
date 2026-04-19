-- Batch 152: Agent Federation Protocol
-- Cross-instance agent federation for distributed collaboration

CREATE TABLE IF NOT EXISTS federation_peers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL UNIQUE,
  instance_name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'token' CHECK (auth_method IN ('token','mtls','oauth','api_key')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','revoked')),
  trust_level INTEGER NOT NULL DEFAULT 0 CHECK (trust_level BETWEEN 0 AND 100),
  last_sync TIMESTAMPTZ,
  capabilities JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS federation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_agent_id UUID NOT NULL,
  peer_id UUID NOT NULL REFERENCES federation_peers(id) ON DELETE CASCADE,
  remote_agent_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'collaboration' CHECK (link_type IN ('collaboration','delegation','mirroring','subscription')),
  bidirectional BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS federation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES federation_links(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  message_type TEXT NOT NULL CHECK (message_type IN ('task','result','event','heartbeat','sync','query')),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','failed','expired')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_federation_peers_status ON federation_peers(status);
CREATE INDEX idx_federation_peers_instance ON federation_peers(instance_id);
CREATE INDEX idx_federation_links_agent ON federation_links(local_agent_id);
CREATE INDEX idx_federation_links_peer ON federation_links(peer_id);
CREATE INDEX idx_federation_messages_link ON federation_messages(link_id);
CREATE INDEX idx_federation_messages_status ON federation_messages(status);

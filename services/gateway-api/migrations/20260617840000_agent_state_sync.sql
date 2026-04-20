-- Batch 147: Agent State Sync
-- Distributed state synchronisation between agents

CREATE TABLE IF NOT EXISTS sync_peers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id),
  peer_agent_id   UUID NOT NULL REFERENCES agents(id),
  direction       TEXT NOT NULL DEFAULT 'bidirectional' CHECK (direction IN ('push','pull','bidirectional')),
  conflict_policy TEXT NOT NULL DEFAULT 'last_write_wins' CHECK (conflict_policy IN ('last_write_wins','first_write_wins','manual','merge','vector_clock')),
  sync_interval   INTEGER NOT NULL DEFAULT 60,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_sync_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, peer_agent_id)
);

CREATE TABLE IF NOT EXISTS sync_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id         UUID NOT NULL REFERENCES sync_peers(id) ON DELETE CASCADE,
  state_key       TEXT NOT NULL,
  state_value     JSONB NOT NULL DEFAULT '{}',
  vector_clock    JSONB NOT NULL DEFAULT '{}',
  version         INTEGER NOT NULL DEFAULT 1,
  checksum        TEXT,
  updated_by      UUID NOT NULL REFERENCES agents(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(peer_id, state_key)
);

CREATE TABLE IF NOT EXISTS sync_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id         UUID NOT NULL REFERENCES sync_peers(id) ON DELETE CASCADE,
  operation       TEXT NOT NULL CHECK (operation IN ('push','pull','merge','conflict_resolve','full_sync','delta_sync')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','conflict')),
  keys_synced     INTEGER NOT NULL DEFAULT 0,
  conflicts_found INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_peers_agent ON sync_peers(agent_id);
CREATE INDEX IF NOT EXISTS idx_sync_peers_peer ON sync_peers(peer_agent_id);
CREATE INDEX IF NOT EXISTS idx_sync_states_peer ON sync_states(peer_id);
CREATE INDEX IF NOT EXISTS idx_sync_states_key ON sync_states(state_key);
CREATE INDEX IF NOT EXISTS idx_sync_ops_peer ON sync_operations(peer_id);
CREATE INDEX IF NOT EXISTS idx_sync_ops_status ON sync_operations(status);

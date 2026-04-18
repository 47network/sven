-- Batch 107 — Agent Database Replication
-- Replica management, lag monitoring, failover orchestration

CREATE TABLE IF NOT EXISTS agent_db_replicas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL,
  cluster_name    TEXT NOT NULL,
  replica_host    TEXT NOT NULL,
  replica_port    INTEGER NOT NULL DEFAULT 5432,
  role            TEXT NOT NULL DEFAULT 'replica' CHECK (role IN ('primary','replica','standby','witness')),
  status          TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','lagging','unreachable','promoting','demoting','failed')),
  replication_mode TEXT NOT NULL DEFAULT 'async' CHECK (replication_mode IN ('sync','async','semi_sync')),
  lag_bytes       BIGINT NOT NULL DEFAULT 0,
  lag_seconds     DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_db_failovers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name    TEXT NOT NULL,
  old_primary     UUID NOT NULL REFERENCES agent_db_replicas(id),
  new_primary     UUID NOT NULL REFERENCES agent_db_replicas(id),
  trigger_reason  TEXT NOT NULL CHECK (trigger_reason IN ('manual','auto_lag','auto_unreachable','auto_health','scheduled')),
  status          TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','fencing','promoting','reconfiguring','completed','failed','rolled_back')),
  data_loss_bytes BIGINT NOT NULL DEFAULT 0,
  downtime_ms     INTEGER NOT NULL DEFAULT 0,
  initiated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_db_replication_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replica_id      UUID NOT NULL REFERENCES agent_db_replicas(id) ON DELETE CASCADE,
  slot_name       TEXT NOT NULL,
  slot_type       TEXT NOT NULL DEFAULT 'physical' CHECK (slot_type IN ('physical','logical')),
  active          BOOLEAN NOT NULL DEFAULT true,
  retained_bytes  BIGINT NOT NULL DEFAULT 0,
  confirmed_lsn   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_db_replicas_agent ON agent_db_replicas(agent_id);
CREATE INDEX idx_db_replicas_cluster ON agent_db_replicas(cluster_name);
CREATE INDEX idx_db_replicas_status ON agent_db_replicas(status);
CREATE INDEX idx_db_failovers_cluster ON agent_db_failovers(cluster_name);
CREATE INDEX idx_db_failovers_status ON agent_db_failovers(status);
CREATE INDEX idx_db_repl_slots_replica ON agent_db_replication_slots(replica_id);

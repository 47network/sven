BEGIN;

CREATE TABLE IF NOT EXISTS swarm_clusters (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  leader_agent_id UUID,
  strategy        TEXT NOT NULL DEFAULT 'consensus' CHECK (strategy IN ('consensus','round_robin','auction','hierarchical','emergent')),
  max_members     INTEGER NOT NULL DEFAULT 10,
  current_members INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','active','degraded','dissolving','dissolved')),
  objective       TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_members (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id      UUID NOT NULL REFERENCES swarm_clusters(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL,
  role            TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('leader','worker','specialist','observer','backup')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','idle','busy','disconnected','evicted')),
  capabilities    JSONB DEFAULT '[]',
  UNIQUE(cluster_id, agent_id)
);

CREATE TABLE IF NOT EXISTS swarm_tasks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cluster_id      UUID NOT NULL REFERENCES swarm_clusters(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES swarm_members(id),
  task_type       TEXT NOT NULL,
  priority        INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  payload         JSONB DEFAULT '{}',
  result          JSONB,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','running','completed','failed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_swarm_clusters_status ON swarm_clusters(status);
CREATE INDEX IF NOT EXISTS idx_swarm_clusters_leader ON swarm_clusters(leader_agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_members_cluster ON swarm_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_swarm_members_agent ON swarm_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_cluster ON swarm_tasks(cluster_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_assigned ON swarm_tasks(assigned_to);

COMMIT;

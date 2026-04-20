BEGIN;

CREATE TABLE IF NOT EXISTS sandbox_environments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id        UUID NOT NULL,
  name            TEXT NOT NULL,
  isolation_level TEXT NOT NULL DEFAULT 'container' CHECK (isolation_level IN ('container','vm','namespace','process','wasm')),
  status          TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','running','paused','terminated','failed')),
  resource_limits JSONB DEFAULT '{"cpu":"500m","memory":"512Mi","disk":"1Gi"}',
  network_policy  TEXT NOT NULL DEFAULT 'restricted' CHECK (network_policy IN ('restricted','internal_only','egress_only','full','none')),
  ttl_seconds     INTEGER DEFAULT 3600,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sandbox_executions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sandbox_id      UUID NOT NULL REFERENCES sandbox_environments(id) ON DELETE CASCADE,
  command         TEXT NOT NULL,
  exit_code       INTEGER,
  stdout_size     INTEGER DEFAULT 0,
  stderr_size     INTEGER DEFAULT 0,
  duration_ms     INTEGER,
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','timeout','killed')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sandbox_violations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sandbox_id      UUID NOT NULL REFERENCES sandbox_environments(id) ON DELETE CASCADE,
  violation_type  TEXT NOT NULL CHECK (violation_type IN ('resource_exceeded','network_breach','fs_escape','syscall_blocked','timeout')),
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  details         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_env_agent ON sandbox_environments(agent_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_env_status ON sandbox_environments(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_exec_sandbox ON sandbox_executions(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_exec_status ON sandbox_executions(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_viol_sandbox ON sandbox_violations(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_viol_type ON sandbox_violations(violation_type);

COMMIT;

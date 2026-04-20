-- Batch 163: Agent Runtime Sandbox
-- Isolated execution environments for untrusted agent code

CREATE TABLE IF NOT EXISTS agent_runtime_sandboxes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  agent_id        UUID NOT NULL,
  sandbox_name    TEXT NOT NULL,
  sandbox_type    TEXT NOT NULL CHECK (sandbox_type IN ('container','wasm','vm','process','namespace')),
  resource_limits JSONB NOT NULL DEFAULT '{"cpuMs":1000,"memoryMb":256,"diskMb":512,"networkKbps":1024}',
  status          TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','ready','running','paused','terminated','error')),
  isolation_level TEXT NOT NULL DEFAULT 'standard' CHECK (isolation_level IN ('minimal','standard','strict','paranoid')),
  allowed_syscalls TEXT[] NOT NULL DEFAULT '{}',
  network_policy  TEXT NOT NULL DEFAULT 'restricted' CHECK (network_policy IN ('none','restricted','internal','full')),
  expires_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_sandbox_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_id      UUID NOT NULL REFERENCES agent_runtime_sandboxes(id),
  command         TEXT NOT NULL,
  exit_code       INT,
  stdout_size     BIGINT NOT NULL DEFAULT 0,
  stderr_size     BIGINT NOT NULL DEFAULT 0,
  cpu_ms_used     INT NOT NULL DEFAULT 0,
  memory_peak_mb  INT NOT NULL DEFAULT 0,
  duration_ms     INT,
  killed_reason   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_sandbox_violations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_id      UUID NOT NULL REFERENCES agent_runtime_sandboxes(id),
  violation_type  TEXT NOT NULL CHECK (violation_type IN ('syscall_blocked','memory_exceeded','cpu_exceeded','disk_exceeded','network_blocked','timeout','escape_attempt')),
  severity        TEXT NOT NULL CHECK (severity IN ('warning','critical','fatal')),
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runtime_sandboxes_agent ON agent_runtime_sandboxes(agent_id);
CREATE INDEX idx_sandbox_executions_sandbox ON agent_sandbox_executions(sandbox_id);
CREATE INDEX idx_sandbox_violations_sandbox ON agent_sandbox_violations(sandbox_id);

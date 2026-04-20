-- Batch 161: Agent Disaster Recovery
-- DR planning, failover orchestration, recovery objectives tracking

CREATE TABLE IF NOT EXISTS agent_dr_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  plan_name       TEXT NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('critical','high','medium','low')),
  rpo_seconds     INT NOT NULL DEFAULT 3600,
  rto_seconds     INT NOT NULL DEFAULT 7200,
  strategy        TEXT NOT NULL CHECK (strategy IN ('active_active','active_passive','pilot_light','backup_restore','cold_standby')),
  primary_region  TEXT NOT NULL,
  failover_region TEXT NOT NULL,
  services        JSONB NOT NULL DEFAULT '[]',
  runbook_url     TEXT,
  last_tested_at  TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','testing','triggered','completed')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dr_failovers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES agent_dr_plans(id),
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('manual','automatic','scheduled_drill','incident')),
  trigger_reason  TEXT,
  failover_status TEXT NOT NULL DEFAULT 'initiated' CHECK (failover_status IN ('initiated','in_progress','completed','failed','rolled_back')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,
  services_failed JSONB NOT NULL DEFAULT '[]',
  data_loss_bytes BIGINT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_dr_checkpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES agent_dr_plans(id),
  checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('snapshot','replication_lag','health_check','sync_status')),
  service_name    TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('healthy','degraded','stale','missing')),
  lag_ms          INT,
  last_sync_at    TIMESTAMPTZ,
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dr_plans_tenant ON agent_dr_plans(tenant_id);
CREATE INDEX idx_dr_failovers_plan ON agent_dr_failovers(plan_id);
CREATE INDEX idx_dr_checkpoints_plan ON agent_dr_checkpoints(plan_id);

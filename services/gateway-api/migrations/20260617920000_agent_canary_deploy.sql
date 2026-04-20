-- Batch 155: Agent Canary Deploy
-- Gradual rollout of agent behavior changes

CREATE TABLE IF NOT EXISTS agent_canary_deploys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('skill','prompt','config','workflow','handler')),
  baseline_version TEXT NOT NULL,
  canary_version TEXT NOT NULL,
  traffic_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','rolled_back','failed')),
  success_threshold NUMERIC(5,2) NOT NULL DEFAULT 95.00,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canary_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deploy_id UUID NOT NULL REFERENCES agent_canary_deploys(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('baseline','canary')),
  total_requests INT NOT NULL DEFAULT 0,
  successful_requests INT NOT NULL DEFAULT 0,
  failed_requests INT NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  error_rate NUMERIC(5,2),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canary_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deploy_id UUID NOT NULL REFERENCES agent_canary_deploys(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('promote','rollback','continue','pause')),
  reason TEXT,
  traffic_pct_before NUMERIC(5,2),
  traffic_pct_after NUMERIC(5,2),
  decided_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_canary_deploys_agent ON agent_canary_deploys(agent_id);
CREATE INDEX idx_canary_deploys_status ON agent_canary_deploys(status);
CREATE INDEX idx_canary_metrics_deploy ON canary_metrics(deploy_id);
CREATE INDEX idx_canary_metrics_variant ON canary_metrics(variant);
CREATE INDEX idx_canary_decisions_deploy ON canary_decisions(deploy_id);
CREATE INDEX idx_canary_decisions_decision ON canary_decisions(decision);

-- Batch 240: DDoS Protector
-- DDoS detection, mitigation, traffic analysis

CREATE TABLE IF NOT EXISTS agent_ddos_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  threshold_rps INTEGER NOT NULL DEFAULT 1000,
  threshold_bandwidth_mbps INTEGER NOT NULL DEFAULT 100,
  mitigation_mode TEXT NOT NULL DEFAULT 'auto' CHECK (mitigation_mode IN ('auto', 'manual', 'challenge', 'block', 'rate_limit')),
  challenge_type TEXT DEFAULT 'captcha' CHECK (challenge_type IN ('captcha', 'js_challenge', 'managed_challenge', 'none')),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ddos_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_ddos_policies(id),
  attack_type TEXT NOT NULL CHECK (attack_type IN ('volumetric', 'protocol', 'application', 'amplification', 'slowloris', 'syn_flood', 'dns_amplification')),
  source_ips TEXT[] DEFAULT '{}',
  peak_rps INTEGER,
  peak_bandwidth_mbps INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mitigated_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mitigating', 'mitigated', 'ended')),
  mitigation_actions JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_ddos_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES agent_ddos_policies(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  requests_per_second INTEGER NOT NULL DEFAULT 0,
  bandwidth_mbps INTEGER NOT NULL DEFAULT 0,
  blocked_requests INTEGER NOT NULL DEFAULT 0,
  challenged_requests INTEGER NOT NULL DEFAULT 0,
  passed_requests INTEGER NOT NULL DEFAULT 0,
  unique_ips INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ddos_policies_agent ON agent_ddos_policies(agent_id);
CREATE INDEX idx_ddos_incidents_policy ON agent_ddos_incidents(policy_id);
CREATE INDEX idx_ddos_incidents_status ON agent_ddos_incidents(status);
CREATE INDEX idx_ddos_incidents_type ON agent_ddos_incidents(attack_type);
CREATE INDEX idx_ddos_metrics_policy ON agent_ddos_metrics(policy_id);
CREATE INDEX idx_ddos_metrics_ts ON agent_ddos_metrics(timestamp);

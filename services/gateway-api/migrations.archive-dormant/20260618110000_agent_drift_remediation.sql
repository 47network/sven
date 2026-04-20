-- Batch 174: Agent Drift Remediation
-- Detects configuration drift from desired state, auto-remediates
-- when safe, escalates when human approval needed

CREATE TABLE IF NOT EXISTS agent_drift_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('config','schema','infrastructure','dependency','environment','security_policy','access_control','network_rule')),
  resource_path TEXT NOT NULL,
  desired_state JSONB NOT NULL,
  current_state JSONB,
  checksum TEXT NOT NULL,
  auto_remediate BOOLEAN NOT NULL DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_drift_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES agent_drift_baselines(id),
  drift_type TEXT NOT NULL CHECK (drift_type IN ('addition','deletion','modification','permission_change','version_mismatch','structural')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  diff_summary TEXT NOT NULL,
  diff_detail JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','investigating','remediating','remediated','accepted','escalated','failed')),
  remediation_plan TEXT,
  remediated_by TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remediated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_drift_remediation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detection_id UUID NOT NULL REFERENCES agent_drift_detections(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('auto_fix','manual_fix','rollback','approve_drift','escalate','suppress')),
  action_detail JSONB NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure','partial','pending')),
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_drift_baselines_agent ON agent_drift_baselines(agent_id);
CREATE INDEX idx_drift_baselines_resource ON agent_drift_baselines(resource_type);
CREATE INDEX idx_drift_detections_status ON agent_drift_detections(status);
CREATE INDEX idx_drift_remediation_detection ON agent_drift_remediation_logs(detection_id);

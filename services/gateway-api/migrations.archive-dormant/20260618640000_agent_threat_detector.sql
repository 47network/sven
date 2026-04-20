-- Batch 227: Threat Detector
CREATE TABLE IF NOT EXISTS agent_threat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('signature','behavioral','anomaly','heuristic','ml_model')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  pattern JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_threat_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES agent_threat_rules(id),
  threat_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT,
  target TEXT,
  evidence JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','investigating','confirmed','mitigated','false_positive')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_threat_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detection_id UUID NOT NULL REFERENCES agent_threat_detections(id),
  response_type TEXT NOT NULL CHECK (response_type IN ('block','alert','quarantine','investigate','auto_remediate')),
  executed_by UUID,
  result TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_threat_rules_agent ON agent_threat_rules(agent_id);
CREATE INDEX idx_threat_detections_rule ON agent_threat_detections(rule_id);
CREATE INDEX idx_threat_responses_detection ON agent_threat_responses(detection_id);

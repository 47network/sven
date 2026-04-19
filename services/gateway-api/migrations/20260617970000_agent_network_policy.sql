-- Batch 160: Agent Network Policy
-- Network security policies, firewall rules, segmentation for agent infrastructure

CREATE TABLE IF NOT EXISTS agent_network_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  policy_name     TEXT NOT NULL,
  policy_type     TEXT NOT NULL CHECK (policy_type IN ('ingress','egress','internal','isolation','rate_limit','geo_block')),
  priority        INT NOT NULL DEFAULT 100,
  action          TEXT NOT NULL DEFAULT 'allow' CHECK (action IN ('allow','deny','log','redirect')),
  source_selector JSONB NOT NULL DEFAULT '{}',
  dest_selector   JSONB NOT NULL DEFAULT '{}',
  protocol        TEXT NOT NULL DEFAULT 'any' CHECK (protocol IN ('tcp','udp','http','https','grpc','any')),
  port_range      TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  segment_name    TEXT NOT NULL,
  cidr_range      TEXT NOT NULL,
  segment_type    TEXT NOT NULL CHECK (segment_type IN ('trusted','dmz','isolated','quarantine','public')),
  vlan_id         INT,
  policies        UUID[] NOT NULL DEFAULT '{}',
  agent_count     INT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_network_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID REFERENCES agent_network_policies(id),
  event_type      TEXT NOT NULL CHECK (event_type IN ('allowed','denied','logged','rate_limited','geo_blocked')),
  source_ip       TEXT,
  dest_ip         TEXT,
  protocol        TEXT,
  port            INT,
  agent_id        UUID,
  details         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_policies_tenant ON agent_network_policies(tenant_id);
CREATE INDEX idx_network_segments_tenant ON agent_network_segments(tenant_id);
CREATE INDEX idx_network_audit_policy ON agent_network_audit_log(policy_id);

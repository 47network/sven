-- Batch 78: Agent Incident Management
-- Tables for tracking, escalating, and resolving incidents across the agent ecosystem

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','investigating','mitigating','resolved','closed','postmortem')),
  source TEXT NOT NULL CHECK (source IN ('agent','monitor','user','system','external')),
  affected_service TEXT,
  affected_agent_id TEXT,
  assigned_agent_id TEXT,
  reporter_id TEXT,
  priority INTEGER DEFAULT 0,
  impact_scope TEXT DEFAULT 'single' CHECK (impact_scope IN ('single','service','cluster','platform','global')),
  root_cause TEXT,
  resolution TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_timeline (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','acknowledged','escalated','assigned','status_change','comment','action_taken','resolved','reopened','closed')),
  actor_id TEXT,
  actor_type TEXT DEFAULT 'agent' CHECK (actor_type IN ('agent','user','system','automation')),
  description TEXT,
  previous_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_escalations (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  from_level INTEGER NOT NULL DEFAULT 1,
  to_level INTEGER NOT NULL,
  reason TEXT,
  escalated_by TEXT,
  escalated_to TEXT,
  auto_escalation BOOLEAN DEFAULT FALSE,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_runbooks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB DEFAULT '{}',
  severity_filter TEXT[],
  service_filter TEXT[],
  steps JSONB NOT NULL DEFAULT '[]',
  auto_execute BOOLEAN DEFAULT FALSE,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_postmortems (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  timeline_summary TEXT,
  root_cause_analysis TEXT,
  contributing_factors JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  lessons_learned TEXT,
  prevention_measures JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  author_id TEXT,
  reviewed_by TEXT[],
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published')),
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for incidents
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_source ON incidents(source);
CREATE INDEX idx_incidents_affected_service ON incidents(affected_service);
CREATE INDEX idx_incidents_affected_agent ON incidents(affected_agent_id);
CREATE INDEX idx_incidents_assigned_agent ON incidents(assigned_agent_id);
CREATE INDEX idx_incidents_priority ON incidents(priority DESC);
CREATE INDEX idx_incidents_started_at ON incidents(started_at DESC);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);

-- Indexes for incident_timeline
CREATE INDEX idx_incident_timeline_incident ON incident_timeline(incident_id);
CREATE INDEX idx_incident_timeline_event_type ON incident_timeline(event_type);
CREATE INDEX idx_incident_timeline_actor ON incident_timeline(actor_id);
CREATE INDEX idx_incident_timeline_created ON incident_timeline(created_at DESC);

-- Indexes for incident_escalations
CREATE INDEX idx_incident_escalations_incident ON incident_escalations(incident_id);
CREATE INDEX idx_incident_escalations_level ON incident_escalations(to_level);
CREATE INDEX idx_incident_escalations_auto ON incident_escalations(auto_escalation);

-- Indexes for incident_runbooks
CREATE INDEX idx_incident_runbooks_auto ON incident_runbooks(auto_execute);
CREATE INDEX idx_incident_runbooks_created ON incident_runbooks(created_at DESC);

-- Indexes for incident_postmortems
CREATE INDEX idx_incident_postmortems_incident ON incident_postmortems(incident_id);
CREATE INDEX idx_incident_postmortems_status ON incident_postmortems(status);

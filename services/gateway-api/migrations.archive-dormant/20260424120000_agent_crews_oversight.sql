-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Batch 20 — Agent Crews, Messaging, Oversight & Anomalies  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── Agent Crews — natural groupings of agents into business teams ──

CREATE TABLE IF NOT EXISTS agent_crews (
  id                TEXT        PRIMARY KEY,
  org_id            TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  crew_type         TEXT        NOT NULL
                      CHECK (crew_type IN ('publishing','research','operations','marketing','legal_compliance','custom')),
  description       TEXT,
  lead_agent_id     TEXT,
  status            TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','suspended','disbanded')),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crews_org   ON agent_crews(org_id);
CREATE INDEX IF NOT EXISTS idx_crews_type  ON agent_crews(crew_type);


-- ── Crew Membership — which agents belong to which crews ──

CREATE TABLE IF NOT EXISTS agent_crew_members (
  crew_id       TEXT        NOT NULL REFERENCES agent_crews(id) ON DELETE CASCADE,
  agent_id      TEXT        NOT NULL,
  role_in_crew  TEXT        NOT NULL DEFAULT 'member'
                  CHECK (role_in_crew IN ('lead','member','specialist','observer')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (crew_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_crew_members_agent ON agent_crew_members(agent_id);


-- ── Inter-Agent Messages — crew coordination + status reports ──

CREATE TABLE IF NOT EXISTS agent_messages (
  id              TEXT        PRIMARY KEY,
  from_agent_id   TEXT        NOT NULL,
  to_agent_id     TEXT,                     -- NULL = broadcast to crew
  crew_id         TEXT,                     -- NULL = direct message
  subject         TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'info'
                    CHECK (message_type IN ('info','alert','anomaly','report','command','task_update')),
  priority        TEXT        NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','critical')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_to   ON agent_messages(to_agent_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_crew  ON agent_messages(crew_id);


-- ── Agent Performance Reports — periodic metrics snapshots ──

CREATE TABLE IF NOT EXISTS agent_performance_reports (
  id                  TEXT          PRIMARY KEY,
  agent_id            TEXT          NOT NULL,
  period_start        TIMESTAMPTZ   NOT NULL,
  period_end          TIMESTAMPTZ   NOT NULL,
  tasks_completed     INTEGER       NOT NULL DEFAULT 0,
  tasks_failed        INTEGER       NOT NULL DEFAULT 0,
  revenue_generated   NUMERIC(15,2) NOT NULL DEFAULT 0,
  tokens_earned       INTEGER       NOT NULL DEFAULT 0,
  anomalies_detected  INTEGER       NOT NULL DEFAULT 0,
  report_data         JSONB         NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_reports_agent ON agent_performance_reports(agent_id);


-- ── Anomaly Records — flagged by accountant agents ──

CREATE TABLE IF NOT EXISTS agent_anomalies (
  id                TEXT        PRIMARY KEY,
  detected_by       TEXT        NOT NULL,
  target_agent_id   TEXT,
  anomaly_type      TEXT        NOT NULL
                      CHECK (anomaly_type IN (
                        'unusual_amount','frequency_spike','revenue_drop',
                        'cost_overrun','dormant_agent','threshold_breach','pattern_deviation'
                      )),
  severity          TEXT        NOT NULL DEFAULT 'medium'
                      CHECK (severity IN ('low','medium','high','critical')),
  description       TEXT        NOT NULL,
  evidence          JSONB       NOT NULL DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','investigating','resolved','dismissed')),
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_status  ON agent_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomalies_target  ON agent_anomalies(target_agent_id);

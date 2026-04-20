-- Batch 40 — Agent Collaboration & Social Dynamics
-- Agent-to-agent collaboration, team formation, reputation-based trust,
-- social interactions, mentorship, and collective intelligence networks.

CREATE TABLE IF NOT EXISTS agent_collaborations (
  id              TEXT PRIMARY KEY,
  initiator_id    TEXT NOT NULL,
  partner_id      TEXT NOT NULL,
  collaboration_type TEXT NOT NULL CHECK (collaboration_type IN (
    'joint_project', 'mentorship', 'peer_review', 'knowledge_share',
    'skill_exchange', 'resource_pooling', 'co_creation', 'delegation'
  )),
  status          TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed', 'negotiating', 'active', 'paused',
    'completed', 'dissolved', 'rejected'
  )),
  terms           JSONB NOT NULL DEFAULT '{}',
  shared_budget   BIGINT NOT NULL DEFAULT 0,
  output_split_pct NUMERIC(5,2) DEFAULT 50,
  trust_score     NUMERIC(5,2) DEFAULT 50,
  messages_count  INT NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_teams (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  purpose         TEXT,
  team_type       TEXT NOT NULL CHECK (team_type IN (
    'project', 'guild', 'squad', 'council', 'research_group',
    'service_crew', 'trading_desk', 'creative_studio'
  )),
  leader_id       TEXT NOT NULL,
  max_members     INT NOT NULL DEFAULT 10,
  status          TEXT NOT NULL DEFAULT 'forming' CHECK (status IN (
    'forming', 'active', 'performing', 'disbanded', 'archived'
  )),
  treasury_tokens BIGINT NOT NULL DEFAULT 0,
  reputation      NUMERIC(5,2) DEFAULT 50,
  specializations JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_team_members (
  team_id         TEXT NOT NULL REFERENCES agent_teams(id),
  agent_id        TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN (
    'leader', 'member', 'specialist', 'advisor', 'apprentice', 'observer'
  )),
  contribution_score NUMERIC(5,2) DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at         TIMESTAMPTZ,
  PRIMARY KEY (team_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_social_interactions (
  id              TEXT PRIMARY KEY,
  from_agent_id   TEXT NOT NULL,
  to_agent_id     TEXT NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'endorsement', 'recommendation', 'challenge', 'greeting',
    'trade_proposal', 'feedback', 'mentoring_session', 'dispute',
    'gift', 'alliance_offer', 'knowledge_transfer', 'debate'
  )),
  content         JSONB NOT NULL DEFAULT '{}',
  sentiment       TEXT CHECK (sentiment IN (
    'positive', 'neutral', 'negative', 'mixed'
  )),
  impact_score    NUMERIC(5,2) DEFAULT 0,
  responded       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collaborations_initiator ON agent_collaborations(initiator_id);
CREATE INDEX idx_collaborations_partner ON agent_collaborations(partner_id);
CREATE INDEX idx_collaborations_status ON agent_collaborations(status);
CREATE INDEX idx_teams_leader ON agent_teams(leader_id);
CREATE INDEX idx_teams_status ON agent_teams(status);
CREATE INDEX idx_team_members_agent ON agent_team_members(agent_id);
CREATE INDEX idx_social_from ON agent_social_interactions(from_agent_id);
CREATE INDEX idx_social_to ON agent_social_interactions(to_agent_id);
CREATE INDEX idx_social_type ON agent_social_interactions(interaction_type);

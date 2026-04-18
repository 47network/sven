-- Batch 43 — Agent Governance & Voting
-- Democratic decision-making for agent collectives.
-- Reputation-weighted voting, proposals, councils, and referenda.

CREATE TABLE IF NOT EXISTS governance_proposals (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'standard',
  category      TEXT NOT NULL DEFAULT 'general',
  status        TEXT NOT NULL DEFAULT 'draft',
  proposer_id   TEXT NOT NULL,
  council_id    TEXT,
  quorum        REAL NOT NULL DEFAULT 0.5,
  threshold     REAL NOT NULL DEFAULT 0.6,
  voting_start  TIMESTAMPTZ,
  voting_end    TIMESTAMPTZ,
  result        TEXT,
  execution     JSONB DEFAULT '{}',
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_votes (
  id           TEXT PRIMARY KEY,
  proposal_id  TEXT NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
  voter_id     TEXT NOT NULL,
  vote         TEXT NOT NULL,
  weight       REAL NOT NULL DEFAULT 1.0,
  reason       TEXT,
  delegated_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, voter_id)
);

CREATE TABLE IF NOT EXISTS governance_councils (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  council_type    TEXT NOT NULL DEFAULT 'general',
  member_limit    INT NOT NULL DEFAULT 7,
  term_length_days INT NOT NULL DEFAULT 90,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance_council_members (
  id          TEXT PRIMARY KEY,
  council_id  TEXT NOT NULL REFERENCES governance_councils(id) ON DELETE CASCADE,
  agent_id    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  term_end    TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'active',
  vote_weight REAL NOT NULL DEFAULT 1.0,
  UNIQUE(council_id, agent_id)
);

CREATE TABLE IF NOT EXISTS governance_delegations (
  id            TEXT PRIMARY KEY,
  delegator_id  TEXT NOT NULL,
  delegate_id   TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT 'all',
  council_id    TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE(delegator_id, scope, council_id)
);

CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_proposer ON governance_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_council ON governance_proposals(council_id);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_type ON governance_proposals(proposal_type);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_voting ON governance_proposals(voting_start, voting_end);
CREATE INDEX IF NOT EXISTS idx_gov_votes_proposal ON governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_gov_votes_voter ON governance_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_gov_councils_status ON governance_councils(status);
CREATE INDEX IF NOT EXISTS idx_gov_council_members_agent ON governance_council_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_gov_council_members_council ON governance_council_members(council_id);
CREATE INDEX IF NOT EXISTS idx_gov_delegations_delegator ON governance_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_gov_delegations_delegate ON governance_delegations(delegate_id);

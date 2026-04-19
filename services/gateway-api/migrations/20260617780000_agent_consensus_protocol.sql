BEGIN;

CREATE TABLE IF NOT EXISTS consensus_proposals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposer_id     UUID NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  proposal_type   TEXT NOT NULL DEFAULT 'standard' CHECK (proposal_type IN ('standard','emergency','constitutional','budget','technical')),
  quorum_required NUMERIC(5,2) NOT NULL DEFAULT 51.00,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','voting','passed','rejected','expired','executed')),
  voting_starts   TIMESTAMPTZ,
  voting_ends     TIMESTAMPTZ,
  payload         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consensus_votes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id     UUID NOT NULL REFERENCES consensus_proposals(id) ON DELETE CASCADE,
  voter_id        UUID NOT NULL,
  vote            TEXT NOT NULL CHECK (vote IN ('approve','reject','abstain')),
  weight          NUMERIC(10,4) NOT NULL DEFAULT 1.0000,
  reason          TEXT,
  voted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, voter_id)
);

CREATE TABLE IF NOT EXISTS consensus_executions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id     UUID NOT NULL REFERENCES consensus_proposals(id) ON DELETE CASCADE,
  executor_id     UUID NOT NULL,
  action_taken    TEXT NOT NULL,
  success         BOOLEAN NOT NULL DEFAULT true,
  result          JSONB DEFAULT '{}',
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consensus_prop_proposer ON consensus_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS idx_consensus_prop_status ON consensus_proposals(status);
CREATE INDEX IF NOT EXISTS idx_consensus_votes_proposal ON consensus_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_consensus_votes_voter ON consensus_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_consensus_exec_proposal ON consensus_executions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_consensus_prop_type ON consensus_proposals(proposal_type);

COMMIT;

-- Migration 126: Cross-agent knowledge sharing mappings for RAG docs

CREATE TABLE IF NOT EXISTS rag_agent_shares (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT,
  doc_id            TEXT NOT NULL,
  target_agent_id   TEXT NOT NULL,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_agent_shares_unique
  ON rag_agent_shares (organization_id, doc_id, target_agent_id);

CREATE INDEX IF NOT EXISTS idx_rag_agent_shares_target
  ON rag_agent_shares (organization_id, target_agent_id, created_at DESC);


-- Migration 125: Retrieval feedback loop for RAG ranking improvements

CREATE TABLE IF NOT EXISTS rag_retrieval_feedback (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT,
  user_id           TEXT,
  query_text        TEXT,
  chunk_id          TEXT NOT NULL,
  doc_id            TEXT,
  source            TEXT,
  content_hash      TEXT,
  signal            TEXT NOT NULL CHECK (signal IN ('positive', 'negative', 'correction')),
  correction_text   TEXT,
  weight            DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_feedback_chunk_created
  ON rag_retrieval_feedback (chunk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_feedback_org_chunk_created
  ON rag_retrieval_feedback (organization_id, chunk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_feedback_doc_created
  ON rag_retrieval_feedback (doc_id, created_at DESC);


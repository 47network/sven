ALTER TABLE rag_embeddings
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS allow_users TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allow_chats TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_visibility ON rag_embeddings(visibility);

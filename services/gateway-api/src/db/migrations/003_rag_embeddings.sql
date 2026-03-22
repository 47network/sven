CREATE TABLE IF NOT EXISTS rag_embeddings (
    id           TEXT PRIMARY KEY,
    doc_id       TEXT NOT NULL,
    chunk_id     TEXT NOT NULL,
    chunk_index  INT NOT NULL,
    source       TEXT NOT NULL,
    source_type  TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding    vector(1536),
    metadata     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_doc ON rag_embeddings(doc_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source ON rag_embeddings(source);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_embedding ON rag_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

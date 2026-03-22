-- Align embeddings dimension with nomic-embed-text (768)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rag_embeddings'
          AND column_name = 'embedding'
    ) THEN
        DROP INDEX IF EXISTS idx_rag_embeddings_embedding;
        ALTER TABLE rag_embeddings
            ALTER COLUMN embedding TYPE vector(768);
        CREATE INDEX IF NOT EXISTS idx_rag_embeddings_embedding
            ON rag_embeddings USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
    END IF;
END $$;

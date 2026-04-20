export type IndexStrategy = 'semantic' | 'keyword' | 'hybrid' | 'dense' | 'sparse';
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed' | 'stale';
export type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'nomic-embed' | 'bge-large' | 'custom';
export type ChunkingMethod = 'fixed_size' | 'semantic' | 'sentence' | 'paragraph' | 'recursive';

export interface KnowledgeIndexerConfig {
  id: string;
  agentId: string;
  indexStrategy: IndexStrategy;
  embeddingModel: EmbeddingModel;
  chunkSize: number;
  chunkOverlap: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeDocument {
  id: string;
  configId: string;
  agentId: string;
  documentTitle: string;
  sourceUrl?: string;
  contentHash: string;
  chunkCount: number;
  tokenCount: number;
  status: DocumentStatus;
  indexedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingVector?: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

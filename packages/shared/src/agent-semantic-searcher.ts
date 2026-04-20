export type SearchStrategy = 'semantic' | 'keyword' | 'hybrid' | 'mmr' | 'bm25';
export type SearchType = 'semantic' | 'keyword' | 'hybrid' | 'exact' | 'fuzzy';
export type RerankModel = 'cross-encoder' | 'cohere-rerank' | 'bge-reranker' | 'none';
export type ResultRelevance = 'highly_relevant' | 'relevant' | 'somewhat_relevant' | 'not_relevant';

export interface SemanticSearcherConfig {
  id: string;
  agentId: string;
  searchStrategy: SearchStrategy;
  rerankingEnabled: boolean;
  maxResults: number;
  similarityThreshold: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  id: string;
  configId: string;
  agentId: string;
  queryText: string;
  queryEmbedding?: number[];
  resultsCount: number;
  latencyMs: number;
  searchType: SearchType;
  filters: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SearchResult {
  id: string;
  queryId: string;
  chunkId?: string;
  rankPosition: number;
  similarityScore: number;
  rerankScore?: number;
  snippet?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

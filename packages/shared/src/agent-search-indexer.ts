export type SearchEngine = 'opensearch' | 'elasticsearch' | 'meilisearch' | 'typesense';
export type IndexStatus = 'green' | 'yellow' | 'red';

export interface AgentSearchIdxConfig {
  id: string; agent_id: string; engine: SearchEngine; index_prefix: string;
  shard_count: number; replica_count: number; refresh_interval_ms: number;
  metadata: Record<string, unknown>; created_at: string; updated_at: string;
}

export interface AgentSearchIndex {
  id: string; config_id: string; index_name: string; doc_count: number;
  size_bytes: number; mapping: Record<string, unknown>; status: IndexStatus; created_at: string;
}

export interface AgentSearchQuery {
  id: string; index_id: string; query_text: string; result_count: number;
  latency_ms: number; filters: Record<string, unknown>; created_at: string;
}

export type IndexType = 'btree' | 'hash' | 'gin' | 'gist' | 'brin' | 'sp_gist';
export type QueryAnalysisState = 'analyzed' | 'optimized' | 'applied' | 'rejected';

export interface AgentQueryTunerConfig {
  id: string; agent_id: string; db_type: string; slow_query_threshold_ms: number;
  auto_suggest: boolean; status: string; created_at: string; updated_at: string;
}
export interface AgentQueryAnalysis {
  id: string; config_id: string; query_text: string; execution_plan: Record<string, unknown>;
  duration_ms: number; rows_examined: number; suggestions: unknown[]; optimized_query: string | null; created_at: string;
}
export interface AgentQueryIndex {
  id: string; config_id: string; table_name: string; index_name: string;
  columns: string[]; index_type: IndexType; applied: boolean; impact_estimate: number; created_at: string;
}

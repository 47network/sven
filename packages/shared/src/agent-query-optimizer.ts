// Batch 207: Query Optimizer — SQL analysis and optimization

export type QueryDatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' | 'opensearch' | 'clickhouse' | 'duckdb' | 'bigquery';
export type QuerySuggestionType = 'add_index' | 'rewrite_query' | 'partition_table' | 'materialize_view' | 'denormalize' | 'cache_result' | 'batch_query' | 'parallel_query';

export interface QueryAnalysis {
  id: string;
  agent_id: string;
  original_query: string;
  normalized_query?: string;
  query_hash?: string;
  database_type: QueryDatabaseType;
  execution_plan?: Record<string, unknown>;
  estimated_cost?: number;
  actual_duration_ms?: number;
  rows_examined?: number;
  rows_returned?: number;
  created_at: string;
}

export interface QuerySuggestion {
  id: string;
  analysis_id: string;
  suggestion_type: QuerySuggestionType;
  description: string;
  optimized_query?: string;
  estimated_improvement_pct?: number;
  applied: boolean;
  applied_at?: string;
  created_at: string;
}

export interface QueryPlanCache {
  id: string;
  query_hash: string;
  agent_id: string;
  execution_plan: Record<string, unknown>;
  hit_count: number;
  avg_duration_ms?: number;
  last_used_at: string;
  expires_at?: string;
  created_at: string;
}

export type QueryOptimizerEvent =
  | 'query.analyzed'
  | 'query.suggestion_generated'
  | 'query.plan_cached'
  | 'query.optimization_applied';

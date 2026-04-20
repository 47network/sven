export type IndexType = 'full_text' | 'vector' | 'hybrid' | 'autocomplete' | 'faceted' | 'geo';

export type IndexStatus = 'building' | 'active' | 'rebuilding' | 'disabled' | 'error';

export type QueryType = 'match' | 'phrase' | 'fuzzy' | 'prefix' | 'wildcard' | 'semantic' | 'boolean';

export type RelevanceRuleType = 'boost' | 'bury' | 'pin' | 'block' | 'function_score' | 'decay';

export type AnalyticsPeriod = 'hour' | 'day' | 'week' | 'month';

export interface SearchIndex {
  id: string;
  name: string;
  indexType: IndexType;
  sourceTable: string;
  status: IndexStatus;
  documentCount: number;
  sizeBytes: number;
  lastIndexed?: string;
  schemaConfig: Record<string, unknown>;
  analyzer: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  id: string;
  indexId: string;
  queryText: string;
  queryType: QueryType;
  filters: Record<string, unknown>;
  resultCount: number;
  tookMs: number;
  userId?: string;
  clickedResults: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SearchSynonym {
  id: string;
  indexId: string;
  term: string;
  synonyms: string[];
  isBidirectional: boolean;
  language: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchRelevanceRule {
  id: string;
  indexId: string;
  ruleType: RelevanceRuleType;
  condition: Record<string, unknown>;
  boostValue: number;
  priority: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchAnalytics {
  id: string;
  indexId: string;
  periodStart: string;
  periodEnd: string;
  totalQueries: number;
  zeroResultQueries: number;
  avgLatencyMs?: number;
  avgResultCount?: number;
  clickThroughRate?: number;
  topQueries: unknown[];
  topZeroResultQueries: unknown[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function isIndexReady(idx: SearchIndex): boolean {
  return idx.status === 'active';
}

export function zeroResultRate(analytics: SearchAnalytics): number {
  if (analytics.totalQueries === 0) return 0;
  return (analytics.zeroResultQueries / analytics.totalQueries) * 100;
}

export function avgQueryLatency(queries: SearchQuery[]): number {
  if (queries.length === 0) return 0;
  return queries.reduce((sum, q) => sum + q.tookMs, 0) / queries.length;
}

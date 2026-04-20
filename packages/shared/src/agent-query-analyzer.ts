export interface QueryAnalyzerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  monitoredDatabases: string[];
  slowQueryThresholdMs: number;
  analysisDepth: string;
  planCapture: boolean;
  recommendationMode: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface SlowQueryReport {
  queryHash: string;
  queryText: string;
  avgDurationMs: number;
  executionCount: number;
  totalDurationMs: number;
  lastExecuted: string;
}
export interface QueryPlan {
  queryHash: string;
  planType: string;
  estimatedCost: number;
  actualRows: number;
  suggestions: string[];
}

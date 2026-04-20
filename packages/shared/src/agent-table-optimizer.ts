export interface TableOptimizerConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  targetTables: string[];
  optimizationGoals: string[];
  vacuumSchedule: string;
  analyzeSchedule: string;
  bloatThresholdPercent: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface TableHealth {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  bloatPercent: number;
  deadTuples: number;
  lastVacuum: string;
  lastAnalyze: string;
}
export interface OptimizationRecommendation {
  tableName: string;
  action: string;
  impact: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
  sql: string;
}

// Batch 173: Agent Cost Anomaly Detection types

export type CostResourceType = 'compute' | 'storage' | 'network' | 'database' | 'api_calls' | 'gpu' | 'bandwidth' | 'licensing';
export type CostAnomalyType = 'spike' | 'trend' | 'forecast_breach' | 'budget_exceeded' | 'unusual_pattern' | 'cost_drift';
export type CostAnomalySeverity = 'info' | 'warning' | 'critical' | 'emergency';
export type CostForecastPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface CostBudget {
  id: string;
  agentId: string;
  budgetName: string;
  resourceType: CostResourceType;
  monthlyLimitTokens: number;
  alertThresholdPct: number;
  currentSpend: number;
  periodStart: string;
  periodEnd: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CostAnomalyDetection {
  id: string;
  budgetId: string;
  anomalyType: CostAnomalyType;
  severity: CostAnomalySeverity;
  detectedValue: number;
  expectedValue: number;
  deviationPct: number;
  rootCause: string | null;
  recommendation: string | null;
  acknowledged: boolean;
  resolved: boolean;
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export interface CostForecast {
  id: string;
  budgetId: string;
  forecastPeriod: CostForecastPeriod;
  predictedSpend: number;
  confidenceLower: number;
  confidenceUpper: number;
  modelType: string;
  accuracyScore: number | null;
  generatedAt: string;
  metadata: Record<string, unknown>;
}

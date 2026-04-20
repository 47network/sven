export interface ThroughputAnalyzerConfig {
  id: string;
  agentId: string;
  metricName: string;
  unit: string;
  windowSeconds: number;
  baselineValue: number;
  alertOnDropPercent: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ThroughputSnapshot {
  metricName: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  unit: string;
  sampledAt: string;
}
export interface ThroughputTrend {
  metricName: string;
  dataPoints: Array<{ timestamp: string; value: number }>;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  avgValue: number;
}

export enum AnomalyAlgorithm {
  ZScore = 'zscore',
  IsolationForest = 'isolation_forest',
  Autoencoder = 'autoencoder',
  MovingAvg = 'moving_avg',
  Percentile = 'percentile',
  Prophet = 'prophet',
}

export enum AnomalySeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum BaselinePeriod {
  Minutely = 'minutely',
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}

export interface AnomalyDetector {
  id: string;
  agentId: string;
  name: string;
  metricSource: string;
  algorithm: AnomalyAlgorithm;
  sensitivity: number;
  windowSize: number;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedAnomaly {
  id: string;
  detectorId: string;
  severity: AnomalySeverity;
  metricValue: number;
  expectedValue: number;
  deviationScore: number;
  context: Record<string, unknown>;
  acknowledged: boolean;
  resolved: boolean;
  detectedAt: string;
}

export interface AnomalyBaseline {
  id: string;
  detectorId: string;
  period: BaselinePeriod;
  meanValue: number;
  stdDeviation: number;
  sampleCount: number;
  computedAt: string;
}

export interface AnomalyDetectionStats {
  totalDetectors: number;
  activeDetectors: number;
  totalAnomalies: number;
  unresolvedAnomalies: number;
  avgDeviationScore: number;
}

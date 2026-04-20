export type ForecastResourceType = 'cpu' | 'memory' | 'storage' | 'network' | 'gpu' | 'tokens';
export type ForecastModelType = 'linear' | 'exponential' | 'seasonal' | 'arima' | 'prophet';
export type CapacityAlertType = 'threshold_breach' | 'trend_warning' | 'anomaly' | 'exhaustion_prediction';

export interface CapacityModel {
  id: string;
  agentId: string;
  name: string;
  resourceType: ForecastResourceType;
  modelType: ForecastModelType;
  trainingWindowDays: number;
  forecastHorizonDays: number;
  confidenceLevel: number;
  lastTrainedAt: string | null;
  accuracyScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapacityForecast {
  id: string;
  modelId: string;
  forecastDate: string;
  predictedUsage: number;
  lowerBound: number;
  upperBound: number;
  actualUsage: number | null;
  unit: string;
  generatedAt: string;
}

export interface CapacityAlert {
  id: string;
  modelId: string;
  alertType: CapacityAlertType;
  severity: string;
  thresholdValue: number | null;
  predictedBreachDate: string | null;
  message: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface CapacityForecastingStats {
  totalModels: number;
  totalForecasts: number;
  activeAlerts: number;
  avgAccuracy: number;
  nextExhaustionDate: string | null;
}

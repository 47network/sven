export interface OutagePredictorConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  predictionWindow: string;
  confidenceThreshold: number;
  dataSources: string[];
  modelType: string;
  retrainInterval: string;
  alertLeadTime: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OutagePrediction {
  id: string;
  configId: string;
  predictedAt: string;
  estimatedOutageTime: string;
  confidence: number;
  affectedServices: string[];
  rootCauseHypothesis: string;
  recommendedActions: string[];
}

export interface PredictionAccuracy {
  id: string;
  predictionId: string;
  actualOutage: boolean;
  actualOutageTime: string | null;
  accuracyScore: number;
  evaluatedAt: string;
}

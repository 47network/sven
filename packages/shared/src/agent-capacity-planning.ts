/* Batch 167 — Agent Capacity Planning */

export type AgentCapacityResourceType = 'compute' | 'memory' | 'storage' | 'gpu' | 'network' | 'agents' | 'tasks';

export type AgentCapacityForecastMethod = 'linear' | 'exponential' | 'seasonal' | 'ml_based' | 'manual';

export type AgentCapacityActionType = 'scale_up' | 'scale_down' | 'provision' | 'decommission' | 'migrate' | 'optimize' | 'alert';

export type AgentCapacityActionPriority = 'critical' | 'high' | 'medium' | 'low';

export type AgentCapacityActionStatus = 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';

export interface AgentCapacityModel {
  id: string;
  tenantId: string;
  modelName: string;
  resourceType: AgentCapacityResourceType;
  forecastMethod: AgentCapacityForecastMethod;
  currentUsage: number;
  maxCapacity: number;
  thresholdPct: number;
  growthRatePct: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCapacityForecast {
  id: string;
  modelId: string;
  forecastDate: string;
  predictedUsage: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  confidencePct: number;
  breachExpected: boolean;
  actionNeeded: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentCapacityAction {
  id: string;
  modelId: string;
  actionType: AgentCapacityActionType;
  description: string;
  estimatedCost: number | null;
  priority: AgentCapacityActionPriority;
  status: AgentCapacityActionStatus;
  approvedBy: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentCapacityPlanningStats {
  totalModels: number;
  breachWarnings: number;
  proposedActions: number;
  avgUtilizationPct: number;
  forecastAccuracy: number;
}

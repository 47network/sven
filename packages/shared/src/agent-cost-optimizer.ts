export interface CostOptimizerConfig {
  id: string;
  agentId: string;
  resourceType: string;
  currentCostMonthly: number;
  targetSavingsPercent: number;
  optimizationStrategy: 'rightsizing' | 'reserved_instances' | 'spot_instances' | 'shutdown_idle' | 'consolidation';
  lastScanAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CostRecommendation {
  resourceId: string;
  resourceType: string;
  currentCost: number;
  projectedCost: number;
  savingsPercent: number;
  action: string;
  risk: string;
}
export interface CostReport {
  period: string;
  totalCost: number;
  savings: number;
  recommendations: CostRecommendation[];
  topSpenders: Array<{ resource: string; cost: number }>;
}

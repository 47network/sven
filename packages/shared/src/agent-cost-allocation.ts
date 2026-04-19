/* Batch 159 — Agent Cost Allocation */

export type AgentCostCenterType =
  | 'agent'
  | 'crew'
  | 'project'
  | 'department'
  | 'service'
  | 'infrastructure';

export type AgentCostBudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type AgentCostCenterStatus = 'active' | 'frozen' | 'closed';

export type AgentCostEntryType =
  | 'compute'
  | 'storage'
  | 'network'
  | 'api_call'
  | 'model_inference'
  | 'bandwidth'
  | 'license'
  | 'other';

export interface AgentCostCenter {
  id: string;
  tenantId: string;
  centerName: string;
  centerType: AgentCostCenterType;
  parentId: string | null;
  budgetLimit: number | null;
  budgetPeriod: AgentCostBudgetPeriod;
  currency: string;
  status: AgentCostCenterStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCostEntry {
  id: string;
  centerId: string;
  entryType: AgentCostEntryType;
  amount: number;
  unitCount: number;
  unitPrice: number;
  description: string | null;
  resourceId: string | null;
  periodStart: string;
  periodEnd: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentCostReport {
  id: string;
  centerId: string;
  reportPeriod: string;
  totalCost: number;
  budgetUsedPct: number;
  topCategories: unknown[];
  anomalies: unknown[];
  recommendations: unknown[];
  generatedAt: string;
}

export interface AgentCostAllocationStats {
  totalCenters: number;
  totalSpend: number;
  avgBudgetUsed: number;
  overBudgetCount: number;
  topCostCategory: string;
}

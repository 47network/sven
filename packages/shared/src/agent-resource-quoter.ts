export type QuoteStatus = 'draft' | 'quoted' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface ResourceQuoterConfig {
  id: string;
  agentId: string;
  defaultCurrency: string;
  quoteValiditySeconds: number;
  autoApproveThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceQuote {
  id: string;
  configId: string;
  resourceType: string;
  resourceSpec: Record<string, unknown>;
  estimatedCost: number;
  currency: string;
  validUntil: string;
  status: QuoteStatus;
  createdAt: string;
}

export interface ResourceAllocation {
  id: string;
  quoteId: string;
  allocatedResources: Record<string, unknown>;
  actualCost: number | null;
  allocatedAt: string;
  releasedAt: string | null;
  createdAt: string;
}

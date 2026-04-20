export type ContractFramework = 'pact' | 'spring_cloud_contract' | 'openapi_diff' | 'custom';
export type ContractStatus = 'active' | 'deprecated' | 'broken' | 'archived';
export type CompatibilityLevel = 'full' | 'backward' | 'forward' | 'none';

export interface AgentContractTesterConfig {
  id: string;
  agentId: string;
  enabled: boolean;
  testFramework: ContractFramework;
  autoVerify: boolean;
  failOnBreaking: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentContract {
  id: string;
  configId: string;
  contractName: string;
  providerService: string;
  consumerService: string;
  contractSpec: Record<string, unknown>;
  version: string;
  status: ContractStatus;
  createdAt: Date;
}

export interface AgentContractResult {
  id: string;
  contractId: string;
  testRunId?: string;
  passed?: boolean;
  breakingChanges: unknown[];
  compatibilityScore?: number;
  testedAt: Date;
}

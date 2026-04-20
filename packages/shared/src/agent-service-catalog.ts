export interface ServiceCatalogConfig {
  id: string;
  agentId: string;
  serviceName: string;
  serviceTier: 'critical' | 'standard' | 'best_effort';
  ownerTeam: string | null;
  dependencies: string[];
  documentationUrl: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ServiceEntry {
  id: string;
  name: string;
  tier: string;
  status: 'active' | 'deprecated' | 'planned' | 'decommissioned';
  ownerTeam: string | null;
  dependencies: string[];
  endpoints: string[];
}
export interface ServiceDependencyGraph {
  services: ServiceEntry[];
  edges: Array<{ from: string; to: string; type: string }>;
}

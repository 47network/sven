export type ResolutionStrategy = 'semver' | 'exact' | 'latest' | 'minimal';

export interface DependencyResolverConfig {
  id: string;
  agentId: string;
  resolutionStrategy: ResolutionStrategy;
  allowPrerelease: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DependencyGraph {
  id: string;
  configId: string;
  name: string;
  rootPackage: string;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  resolvedAt: string | null;
  createdAt: string;
}

export interface DependencyConflict {
  id: string;
  graphId: string;
  packageName: string;
  requiredVersions: string[];
  resolvedVersion: string | null;
  resolutionMethod: string | null;
  createdAt: string;
}

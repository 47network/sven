/* Batch 143 — Agent Dependency Graph */

export enum DepGraphKind {
  Service = 'service',
  Data = 'data',
  Task = 'task',
  Resource = 'resource',
  Agent = 'agent',
}

export enum DepNodeType {
  Service = 'service',
  Database = 'database',
  Api = 'api',
  Queue = 'queue',
  Agent = 'agent',
  File = 'file',
  Package = 'package',
}

export enum DepEdgeType {
  DependsOn = 'depends_on',
  Imports = 'imports',
  Calls = 'calls',
  Reads = 'reads',
  Writes = 'writes',
  Produces = 'produces',
  Consumes = 'consumes',
}

export interface DependencyGraph {
  id: string;
  agentId: string;
  name: string;
  graphKind: DepGraphKind;
  rootNodeId?: string;
  nodeCount: number;
  edgeCount: number;
  isAcyclic: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DependencyNode {
  id: string;
  graphId: string;
  label: string;
  nodeType: DepNodeType;
  version?: string;
  depth: number;
  inDegree: number;
  outDegree: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface DependencyEdge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: DepEdgeType;
  weight: number;
  isCritical: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface DependencyGraphStats {
  totalGraphs: number;
  totalNodes: number;
  totalEdges: number;
  acyclicRatio: number;
  avgDepth: number;
  criticalEdges: number;
}

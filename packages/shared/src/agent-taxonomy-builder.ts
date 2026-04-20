export type TaxonomyNodeType = 'category' | 'subcategory' | 'tag' | 'topic' | 'concept';
export type ClassificationMethod = 'auto' | 'manual' | 'hybrid' | 'rule_based' | 'ml_based';
export type MergeStrategy = 'similarity' | 'hierarchy' | 'frequency' | 'manual';
export type AssignmentSource = 'auto' | 'manual' | 'rule' | 'ml' | 'imported';

export interface TaxonomyBuilderConfig {
  id: string;
  agentId: string;
  maxDepth: number;
  autoClassify: boolean;
  mergeThreshold: number;
  language: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxonomyNode {
  id: string;
  configId: string;
  parentId?: string;
  nodeName: string;
  nodeSlug: string;
  description?: string;
  depthLevel: number;
  itemCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface TaxonomyAssignment {
  id: string;
  nodeId: string;
  entityType: string;
  entityId: string;
  confidence: number;
  assignedBy: AssignmentSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

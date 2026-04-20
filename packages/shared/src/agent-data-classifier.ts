export type DataClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';
export type ClassifiedBy = 'auto' | 'manual' | 'policy' | 'ml_model';

export interface AgentDataClassification {
  id: string;
  agentId: string;
  resourceType: string;
  resourceId: string;
  classification: DataClassificationLevel;
  labels: string[];
  confidence: number;
  classifiedBy: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentClassificationRule {
  id: string;
  agentId: string;
  ruleName: string;
  pattern: Record<string, unknown>;
  targetClassification: DataClassificationLevel;
  priority: number;
  enabled: boolean;
  createdAt: Date;
}

export interface AgentDataLineage {
  id: string;
  classificationId: string;
  sourceSystem: string;
  transformation?: string;
  destinationSystem?: string;
  trackedAt: Date;
}

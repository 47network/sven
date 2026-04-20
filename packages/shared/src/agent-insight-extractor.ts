export type InsightType = 'finding' | 'trend' | 'anomaly' | 'recommendation' | 'risk' | 'opportunity';
export type InsightCategory = 'market' | 'technical' | 'financial' | 'operational' | 'strategic' | 'competitive';
export type ConnectionType = 'related' | 'contradicts' | 'supports' | 'causes' | 'precedes' | 'follows';
export type ExtractionDepth = 'surface' | 'moderate' | 'deep' | 'exhaustive';

export interface InsightExtractorConfig {
  id: string;
  agentId: string;
  extractionModel: string;
  confidenceThreshold: number;
  maxInsightsPerDoc: number;
  categorizeInsights: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedInsight {
  id: string;
  configId: string;
  agentId: string;
  sourceDocumentId?: string;
  insightText: string;
  insightType: InsightType;
  category?: InsightCategory;
  confidence: number;
  supportingEvidence?: string;
  actionable: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface InsightConnection {
  id: string;
  sourceInsightId: string;
  targetInsightId: string;
  connectionType: ConnectionType;
  strength: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

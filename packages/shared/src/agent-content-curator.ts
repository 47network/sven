export type CurationStrategy = 'quality_first' | 'freshness_first' | 'balanced' | 'diversity' | 'engagement';
export type CollectionStatus = 'draft' | 'curating' | 'review' | 'published' | 'archived';
export type ContentQuality = 'premium' | 'high' | 'medium' | 'low' | 'unrated';
export type SourceReliability = 'authoritative' | 'reliable' | 'moderate' | 'uncertain' | 'unknown';

export interface ContentCuratorConfig {
  id: string;
  agentId: string;
  curationStrategy: CurationStrategy;
  freshnessWeight: number;
  relevanceWeight: number;
  diversityWeight: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CuratedCollection {
  id: string;
  configId: string;
  agentId: string;
  collectionName: string;
  description?: string;
  topic: string;
  itemCount: number;
  qualityScore: number;
  published: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CuratedItem {
  id: string;
  collectionId: string;
  sourceUrl: string;
  title: string;
  summary?: string;
  relevanceScore: number;
  qualityScore: number;
  position: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

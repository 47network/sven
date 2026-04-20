/* Batch 62 — Agent Marketplace Recommendations */

export type RecommendationSourceType = 'collaborative' | 'content' | 'trending' | 'personalized' | 'similar';
export type RecommendationItemType = 'skill' | 'service' | 'agent' | 'product' | 'crew';
export type RecommendationModelType = 'collaborative_filter' | 'content_based' | 'hybrid' | 'popularity' | 'contextual';
export type RecommendationModelStatus = 'training' | 'active' | 'deprecated' | 'failed';
export type AgentmInteractionType = 'view' | 'click' | 'purchase' | 'dismiss' | 'bookmark' | 'share';
export type CampaignType = 'seasonal' | 'launch' | 'trending' | 'clearance' | 'personalized';
export type RecommendationAction = 'recommend_generate' | 'model_train' | 'interaction_record' | 'campaign_create' | 'feedback_submit' | 'recommend_refresh' | 'campaign_manage';

export const RECOMMENDATION_SOURCE_TYPES: RecommendationSourceType[] = ['collaborative', 'content', 'trending', 'personalized', 'similar'];
export const RECOMMENDATION_ITEM_TYPES: RecommendationItemType[] = ['skill', 'service', 'agent', 'product', 'crew'];
export const RECOMMENDATION_MODEL_TYPES: RecommendationModelType[] = ['collaborative_filter', 'content_based', 'hybrid', 'popularity', 'contextual'];
export const INTERACTION_TYPES: AgentmInteractionType[] = ['view', 'click', 'purchase', 'dismiss', 'bookmark', 'share'];
export const CAMPAIGN_TYPES: CampaignType[] = ['seasonal', 'launch', 'trending', 'clearance', 'personalized'];
export const RECOMMENDATION_ACTIONS: RecommendationAction[] = ['recommend_generate', 'model_train', 'interaction_record', 'campaign_create', 'feedback_submit', 'recommend_refresh', 'campaign_manage'];

export interface Recommendation {
  id: string;
  targetAgentId: string;
  sourceType: RecommendationSourceType;
  itemType: RecommendationItemType;
  itemId: string;
  score: number;
  reason?: string;
  context: Record<string, unknown>;
  viewed: boolean;
  clicked: boolean;
  converted: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface RecommendationModel {
  id: string;
  modelName: string;
  modelType: RecommendationModelType;
  version: string;
  accuracy?: number;
  trainingData: Record<string, unknown>;
  parameters: Record<string, unknown>;
  status: RecommendationModelStatus;
  lastTrained?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationInteraction {
  id: string;
  agentId: string;
  itemType: RecommendationItemType;
  itemId: string;
  interaction: AgentmInteractionType;
  durationMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecommendationCampaign {
  id: string;
  campaignName: string;
  campaignType: CampaignType;
  targetSegment?: string;
  itemIds: string[];
  boostFactor: number;
  startDate: string;
  endDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationFeedback {
  id: string;
  recommendationId: string;
  agentId: string;
  feedbackType: string;
  comment?: string;
  createdAt: string;
}

export function isRecommendationExpired(rec: Recommendation): boolean {
  if (!rec.expiresAt) return false;
  return new Date(rec.expiresAt) < new Date();
}

export function isModelActive(model: RecommendationModel): boolean {
  return model.status === 'active';
}

export function isHighScoreRecommendation(rec: Recommendation, threshold = 0.75): boolean {
  return rec.score >= threshold;
}

export function calculateConversionRate(recs: Recommendation[]): number {
  if (recs.length === 0) return 0;
  const converted = recs.filter(r => r.converted).length;
  return converted / recs.length;
}

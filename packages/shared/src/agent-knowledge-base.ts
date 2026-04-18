// Batch 51: Agent Knowledge Base & Documentation — shared types

export type KnowledgeArticleType =
  | 'article'
  | 'faq'
  | 'runbook'
  | 'tutorial'
  | 'reference'
  | 'troubleshooting'
  | 'best_practice'
  | 'changelog'
  | 'glossary';

export type KnowledgeArticleStatus =
  | 'draft'
  | 'review'
  | 'published'
  | 'archived'
  | 'deprecated';

export type KnowledgeVisibility =
  | 'internal'
  | 'team'
  | 'public'
  | 'restricted';

export type KnowledgeCategory =
  | 'general'
  | 'engineering'
  | 'operations'
  | 'security'
  | 'onboarding'
  | 'architecture'
  | 'api_reference'
  | 'deployment'
  | 'incident_response';

export type KnowledgeFeedbackType =
  | 'helpful'
  | 'not_helpful'
  | 'outdated'
  | 'inaccurate'
  | 'suggestion';

export type KnowledgeSearchScope =
  | 'all'
  | 'published'
  | 'internal'
  | 'team'
  | 'mine';

export type KnowledgeAction =
  | 'article_create'
  | 'article_update'
  | 'article_publish'
  | 'article_archive'
  | 'article_search'
  | 'feedback_submit'
  | 'category_manage';

export interface KnowledgeArticle {
  id: string;
  agentId: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  category: KnowledgeCategory;
  articleType: KnowledgeArticleType;
  status: KnowledgeArticleStatus;
  visibility: KnowledgeVisibility;
  version: number;
  parentId?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRevision {
  id: string;
  articleId: string;
  revisionNumber: number;
  content: string;
  summary?: string;
  changeNote?: string;
  authorAgentId: string;
  createdAt: string;
}

export interface KnowledgeCategoryInfo {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  icon?: string;
  sortOrder: number;
  articleCount: number;
  createdAt: string;
}

export interface KnowledgeFeedback {
  id: string;
  articleId: string;
  agentId?: string;
  feedbackType: KnowledgeFeedbackType;
  comment?: string;
  rating?: number;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  articleId: string;
  title: string;
  slug: string;
  summary?: string;
  category: KnowledgeCategory;
  relevanceScore: number;
}

export const KNOWLEDGE_ARTICLE_TYPES: KnowledgeArticleType[] = [
  'article', 'faq', 'runbook', 'tutorial', 'reference',
  'troubleshooting', 'best_practice', 'changelog', 'glossary',
];

export const KNOWLEDGE_STATUSES: KnowledgeArticleStatus[] = [
  'draft', 'review', 'published', 'archived', 'deprecated',
];

export const KNOWLEDGE_VISIBILITIES: KnowledgeVisibility[] = [
  'internal', 'team', 'public', 'restricted',
];

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'general', 'engineering', 'operations', 'security', 'onboarding',
  'architecture', 'api_reference', 'deployment', 'incident_response',
];

export const KNOWLEDGE_FEEDBACK_TYPES: KnowledgeFeedbackType[] = [
  'helpful', 'not_helpful', 'outdated', 'inaccurate', 'suggestion',
];

export const KNOWLEDGE_ACTIONS: KnowledgeAction[] = [
  'article_create', 'article_update', 'article_publish',
  'article_archive', 'article_search', 'feedback_submit', 'category_manage',
];

export function isArticlePublishable(status: KnowledgeArticleStatus): boolean {
  return status === 'draft' || status === 'review';
}

export function isArticleEditable(status: KnowledgeArticleStatus): boolean {
  return status !== 'archived' && status !== 'deprecated';
}

export function getArticleQualityScore(article: Pick<KnowledgeArticle, 'content' | 'summary' | 'tags' | 'viewCount' | 'helpfulCount'>): number {
  let score = 0;
  if (article.content.length > 200) score += 30;
  if (article.summary && article.summary.length > 20) score += 20;
  if (article.tags.length >= 2) score += 15;
  if (article.viewCount > 10) score += 15;
  if (article.helpfulCount > 3) score += 20;
  return Math.min(score, 100);
}

export function calculateHelpfulnessRatio(helpful: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((helpful / total) * 100) / 100;
}

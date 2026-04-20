/* Batch 61 — Agent Feedback & Surveys shared types */

export type FeedbackType = 'rating' | 'comment' | 'suggestion' | 'complaint' | 'praise';
export type FeedbackCategory = 'quality' | 'speed' | 'accuracy' | 'communication' | 'value';
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
export type SurveyType = 'satisfaction' | 'nps' | 'feature_request' | 'exit' | 'onboarding';
export type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';
export type ImprovementActionType = 'skill_update' | 'behavior_change' | 'prompt_tuning' | 'escalation' | 'training';
export type FeedbackSurveyAction = 'feedback_submit' | 'survey_create' | 'survey_respond' | 'analytics_generate' | 'improvement_propose' | 'feedback_acknowledge' | 'survey_close';

export interface FeedbackEntry {
  id: string;
  agentId: string;
  submitterId: string;
  feedbackType: FeedbackType;
  category: FeedbackCategory;
  rating?: number;
  title?: string;
  body?: string;
  sentiment: FeedbackSentiment;
}

export interface SurveyDefinition {
  id: string;
  agentId: string;
  title: string;
  surveyType: SurveyType;
  status: SurveyStatus;
  questions: unknown[];
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentId: string;
  answers: Record<string, unknown>;
  score?: number;
  completionPct: number;
}

export interface FeedbackAnalytics {
  id: string;
  agentId: string;
  period: string;
  totalFeedback: number;
  avgRating?: number;
  npsScore?: number;
}

export interface ImprovementAction {
  id: string;
  agentId: string;
  actionType: ImprovementActionType;
  priority: string;
  description: string;
  status: string;
}

export const FEEDBACK_TYPES: readonly FeedbackType[] = ['rating', 'comment', 'suggestion', 'complaint', 'praise'] as const;
export const FEEDBACK_CATEGORIES: readonly FeedbackCategory[] = ['quality', 'speed', 'accuracy', 'communication', 'value'] as const;
export const FEEDBACK_SENTIMENTS: readonly FeedbackSentiment[] = ['positive', 'neutral', 'negative', 'mixed', 'unknown'] as const;
export const SURVEY_TYPES: readonly SurveyType[] = ['satisfaction', 'nps', 'feature_request', 'exit', 'onboarding'] as const;
export const SURVEY_STATUSES: readonly SurveyStatus[] = ['draft', 'active', 'paused', 'closed', 'archived'] as const;
export const IMPROVEMENT_ACTION_TYPES: readonly ImprovementActionType[] = ['skill_update', 'behavior_change', 'prompt_tuning', 'escalation', 'training'] as const;

export function isFeedbackPositive(sentiment: FeedbackSentiment): boolean {
  return sentiment === 'positive';
}

export function isSurveyActive(status: SurveyStatus): boolean {
  return status === 'active';
}

export function isImprovementCompleted(status: string): boolean {
  return status === 'completed';
}

export function calculateNps(promoters: number, detractors: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(((promoters - detractors) / total) * 100);
}

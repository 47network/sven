/**
 * Publishing Pipeline — types and helpers for Sven's editorial workflow.
 *
 * Covers the full lifecycle: manuscript → editing → proofreading → formatting
 * → cover design → quality review → approved → published.
 */

// ────────────────────────────── Status Enums ──────────────────────────────

export type PublishingStatus =
  | 'manuscript'
  | 'editing'
  | 'proofreading'
  | 'formatting'
  | 'cover_design'
  | 'review'
  | 'approved'
  | 'published'
  | 'rejected';

export type EditorialStageType =
  | 'editing'
  | 'proofreading'
  | 'formatting'
  | 'cover_design'
  | 'review'
  | 'genre_research';

export type StageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export type BookFormat =
  | 'epub'
  | 'kindle_mobi'
  | 'pdf'
  | 'paperback'
  | 'hardcover'
  | 'audiobook';

export type QualityCategory =
  | 'grammar'
  | 'style'
  | 'plot'
  | 'pacing'
  | 'characters'
  | 'worldbuilding'
  | 'formatting'
  | 'cover'
  | 'overall';

// ────────────────────────────── Interfaces ──────────────────────────────

export interface PublishingProject {
  id: string;
  orgId: string;
  authorAgentId: string;
  title: string;
  genre: string;
  language: string;
  synopsis: string | null;
  status: PublishingStatus;
  wordCount: number;
  chapterCount: number;
  targetFormat: BookFormat;
  manuscriptUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EditorialStage {
  id: string;
  projectId: string;
  stageType: EditorialStageType;
  status: StageStatus;
  assignedAgentId: string | null;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QualityReview {
  id: string;
  stageId: string;
  projectId: string;
  reviewerAgentId: string;
  score: number;
  category: QualityCategory;
  feedback: string | null;
  approved: boolean;
  criteria: Record<string, unknown>;
  createdAt: string;
}

export interface BookCatalogEntry {
  id: string;
  projectId: string;
  listingId: string | null;
  isbn: string | null;
  coverUrl: string | null;
  format: BookFormat;
  pageCount: number;
  salesCount: number;
  totalRevenue: number;
  metadata: Record<string, unknown>;
  publishedAt: string;
  createdAt: string;
}

// ────────────────────────────── Stage Progression ──────────────────────────────

/** Ordered pipeline stages — projects advance through this sequence. */
export const PUBLISHING_STATUS_ORDER: PublishingStatus[] = [
  'manuscript',
  'editing',
  'proofreading',
  'formatting',
  'cover_design',
  'review',
  'approved',
  'published',
];

/**
 * Check whether a project can advance from `current` to `next` status.
 * Allows forward progression only (no skipping more than 1 step).
 * Special cases: 'rejected' can be set from 'review', and 'published' only from 'approved'.
 */
export function canAdvanceTo(current: PublishingStatus, next: PublishingStatus): boolean {
  if (current === next) return false;

  // 'rejected' can only come from 'review'
  if (next === 'rejected') return current === 'review';

  const currentIdx = PUBLISHING_STATUS_ORDER.indexOf(current);
  const nextIdx = PUBLISHING_STATUS_ORDER.indexOf(next);

  if (currentIdx < 0 || nextIdx < 0) return false;

  // Allow advancing exactly one step forward
  return nextIdx === currentIdx + 1;
}

/** Map editorial stage type → corresponding publishing project status. */
export function stageTypeToProjectStatus(stageType: EditorialStageType): PublishingStatus | null {
  const map: Record<EditorialStageType, PublishingStatus | null> = {
    editing: 'editing',
    proofreading: 'proofreading',
    formatting: 'formatting',
    cover_design: 'cover_design',
    review: 'review',
    genre_research: null, // genre_research doesn't change project status
  };
  return map[stageType] ?? null;
}

/** All valid publishing task types for the task executor. */
export const PUBLISHING_TASK_TYPES = [
  'review',
  'proofread',
  'format',
  'cover_design',
  'genre_research',
] as const;

export type PublishingTaskType = (typeof PUBLISHING_TASK_TYPES)[number];

/** Minimum quality score to auto-approve a review (0–100). */
export const MIN_APPROVAL_SCORE = 70;

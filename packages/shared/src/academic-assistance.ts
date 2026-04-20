// ---------------------------------------------------------------------------
// Academic Assistance — shared types for legitimate tutoring, formatting,
// citation, and research guidance services.
// ---------------------------------------------------------------------------

export type AcademicServiceType =
  | 'tutoring'
  | 'formatting'
  | 'citation_review'
  | 'bibliography'
  | 'research_guidance'
  | 'methodology_review'
  | 'structure_review'
  | 'plagiarism_check'
  | 'language_editing'
  | 'presentation_coaching'
  | 'statistical_analysis'
  | 'literature_review';

export type AcademicProjectType =
  | 'licenta'
  | 'disertatie'
  | 'referat'
  | 'eseu'
  | 'proiect_semestrial'
  | 'teza_doctorat'
  | 'articol_stiintific'
  | 'prezentare';

export type AcademicProjectStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'formatting'
  | 'citation_check'
  | 'language_edit'
  | 'completed'
  | 'delivered'
  | 'cancelled';

export type AcademicReviewType =
  | 'formatting'
  | 'citation'
  | 'plagiarism'
  | 'grammar'
  | 'structure'
  | 'methodology'
  | 'content_quality'
  | 'presentation'
  | 'final_check';

export type AcademicReviewStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'needs_revision';

export type CitationStyle =
  | 'apa7'
  | 'chicago'
  | 'mla9'
  | 'ieee'
  | 'harvard'
  | 'iso690'
  | 'vancouver';

export type SourceType =
  | 'book'
  | 'journal'
  | 'website'
  | 'conference'
  | 'thesis'
  | 'report'
  | 'legislation'
  | 'standard'
  | 'patent';

export const ACADEMIC_SERVICE_TYPES: AcademicServiceType[] = [
  'tutoring', 'formatting', 'citation_review', 'bibliography',
  'research_guidance', 'methodology_review', 'structure_review',
  'plagiarism_check', 'language_editing', 'presentation_coaching',
  'statistical_analysis', 'literature_review',
];

export const ACADEMIC_PROJECT_TYPES: AcademicProjectType[] = [
  'licenta', 'disertatie', 'referat', 'eseu', 'proiect_semestrial',
  'teza_doctorat', 'articol_stiintific', 'prezentare',
];

export const ACADEMIC_PROJECT_STATUSES: AcademicProjectStatus[] = [
  'draft', 'submitted', 'in_review', 'formatting', 'citation_check',
  'language_edit', 'completed', 'delivered', 'cancelled',
];

export const ACADEMIC_REVIEW_TYPES: AcademicReviewType[] = [
  'formatting', 'citation', 'plagiarism', 'grammar', 'structure',
  'methodology', 'content_quality', 'presentation', 'final_check',
];

export const CITATION_STYLES: CitationStyle[] = [
  'apa7', 'chicago', 'mla9', 'ieee', 'harvard', 'iso690', 'vancouver',
];

export const SOURCE_TYPES: SourceType[] = [
  'book', 'journal', 'website', 'conference', 'thesis',
  'report', 'legislation', 'standard', 'patent',
];

export interface AcademicService {
  id: string;
  name: string;
  description: string;
  serviceType: AcademicServiceType;
  language: string;
  priceTokens: number;
  priceEur: number;
  agentId: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicProject {
  id: string;
  studentAlias: string;
  projectType: AcademicProjectType;
  title: string;
  faculty: string;
  university: string;
  language: string;
  wordCount: number;
  pageCount: number;
  status: AcademicProjectStatus;
  deadline: string | null;
  assignedAgents: string[];
  servicesUsed: string[];
  qualityScore: number | null;
  feedback: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicReview {
  id: string;
  projectId: string;
  serviceId: string | null;
  reviewerId: string;
  reviewType: AcademicReviewType;
  status: AcademicReviewStatus;
  score: number | null;
  findings: string[];
  suggestions: string[];
  corrected: boolean;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AcademicCitation {
  id: string;
  projectId: string;
  citationStyle: CitationStyle;
  sourceType: SourceType;
  rawText: string;
  formattedText: string;
  valid: boolean;
  doi: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const ACADEMIC_STATUS_ORDER: AcademicProjectStatus[] = [
  'draft', 'submitted', 'in_review', 'formatting',
  'citation_check', 'language_edit', 'completed', 'delivered',
];

export function canAdvanceAcademic(
  current: AcademicProjectStatus,
  next: AcademicProjectStatus,
): boolean {
  if (next === 'cancelled') return true;
  const ci = ACADEMIC_STATUS_ORDER.indexOf(current);
  const ni = ACADEMIC_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

// ---------------------------------------------------------------------------
// Research Labs — shared types for Batch 38
// Agent-operated research infrastructure: labs, projects, papers, datasets
// ---------------------------------------------------------------------------

export type ResearchFocusArea =
  | 'nlp'
  | 'computer_vision'
  | 'reinforcement_learning'
  | 'data_science'
  | 'cybersecurity'
  | 'economics'
  | 'social_science'
  | 'engineering'
  | 'medicine'
  | 'environment'
  | 'general';

export type LabStatus = 'founding' | 'active' | 'publishing' | 'dormant' | 'archived';

export type ResearchProjectStatus =
  | 'proposal'
  | 'approved'
  | 'data_collection'
  | 'analysis'
  | 'writing'
  | 'peer_review'
  | 'revision'
  | 'published'
  | 'archived';

export type PaperStatus = 'draft' | 'submitted' | 'under_review' | 'accepted' | 'published' | 'retracted';

export type DatasetFormat = 'csv' | 'json' | 'parquet' | 'sql_dump' | 'binary' | 'mixed';

export type DatasetAccessLevel = 'public' | 'marketplace' | 'lab_only' | 'project_only';

export const RESEARCH_FOCUS_AREAS: readonly ResearchFocusArea[] = [
  'nlp', 'computer_vision', 'reinforcement_learning', 'data_science',
  'cybersecurity', 'economics', 'social_science', 'engineering',
  'medicine', 'environment', 'general',
] as const;

export const RESEARCH_PROJECT_STATUSES: readonly ResearchProjectStatus[] = [
  'proposal', 'approved', 'data_collection', 'analysis',
  'writing', 'peer_review', 'revision', 'published', 'archived',
] as const;

export const PAPER_STATUSES: readonly PaperStatus[] = [
  'draft', 'submitted', 'under_review', 'accepted', 'published', 'retracted',
] as const;

export interface ResearchLab {
  id: string;
  agentId: string;
  domainId: string | null;
  name: string;
  slug: string;
  focusArea: ResearchFocusArea;
  status: LabStatus;
  description: string;
  capabilities: string[];
  memberAgentIds: string[];
  papersCount: number;
  datasetsCount: number;
  reputation: number;
  tokensFunded: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProject {
  id: string;
  labId: string;
  title: string;
  abstract: string;
  methodology: string;
  status: ResearchProjectStatus;
  leadAgentId: string;
  collaborators: string[];
  tags: string[];
  budgetTokens: number;
  spentTokens: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchPaper {
  id: string;
  projectId: string;
  labId: string;
  title: string;
  abstract: string;
  authors: string[];
  keywords: string[];
  contentUrl: string | null;
  doi: string | null;
  citationCount: number;
  peerReviewScore: number | null;
  status: PaperStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDataset {
  id: string;
  labId: string;
  projectId: string | null;
  name: string;
  description: string;
  format: DatasetFormat;
  sizeBytes: number;
  recordCount: number;
  license: string;
  accessLevel: DatasetAccessLevel;
  storageUrl: string | null;
  checksum: string | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_STATUS_ORDER: Record<ResearchProjectStatus, number> = {
  proposal: 0,
  approved: 1,
  data_collection: 2,
  analysis: 3,
  writing: 4,
  peer_review: 5,
  revision: 6,
  published: 7,
  archived: 8,
};

export function canAdvanceProject(current: ResearchProjectStatus, next: ResearchProjectStatus): boolean {
  if (next === 'archived') return true;
  if (next === 'revision' && current === 'peer_review') return true;
  return PROJECT_STATUS_ORDER[next] === PROJECT_STATUS_ORDER[current] + 1;
}

export const FOCUS_AREA_LABELS: Record<ResearchFocusArea, string> = {
  nlp: 'Natural Language Processing',
  computer_vision: 'Computer Vision',
  reinforcement_learning: 'Reinforcement Learning',
  data_science: 'Data Science',
  cybersecurity: 'Cybersecurity',
  economics: 'Economics & Finance',
  social_science: 'Social Science',
  engineering: 'Engineering',
  medicine: 'Medicine & Health',
  environment: 'Environmental Science',
  general: 'General Research',
};

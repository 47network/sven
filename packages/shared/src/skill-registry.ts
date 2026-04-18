/* ── Batch 31 — Skill Registry types ─────────────────────────── */

// ── Categories ────────────────────────────────────────────────
export type SkillCategory =
  | 'ai-agency'
  | 'autonomous-economy'
  | 'compute-mesh'
  | 'design'
  | 'email-generic'
  | 'marketing'
  | 'notifications'
  | 'ocr'
  | 'productivity'
  | 'security'
  | 'trading'
  | 'data-engineering'
  | 'web-scraping'
  | 'devops'
  | 'research'
  | 'quantum'
  | 'automotive';

export type SkillSource =
  | 'native'
  | 'imported'
  | 'community'
  | 'forked';

export type IntegrationStatus =
  | 'discovered'
  | 'evaluating'
  | 'adapting'
  | 'testing'
  | 'integrated'
  | 'deprecated';

export type QualityTier =
  | 'experimental'
  | 'beta'
  | 'stable'
  | 'certified';

export type ImportStatus =
  | 'pending'
  | 'downloading'
  | 'adapting'
  | 'testing'
  | 'completed'
  | 'failed';

export type ImportSourceType =
  | 'github'
  | 'npm'
  | 'local'
  | 'url'
  | 'marketplace';

// ── Interfaces ────────────────────────────────────────────────
export interface SkillRegistryEntry {
  id: string;
  name: string;
  category: SkillCategory;
  source: SkillSource;
  version: string;
  integrationStatus: IntegrationStatus;
  qualityTier: QualityTier;
  archetype: string | null;
  description: string | null;
  actions: string[];
  pricing: Record<string, unknown>;
  skillPath: string | null;
  marketplaceListingId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SkillQualityAssessment {
  id: string;
  skillId: string;
  assessorAgentId: string | null;
  score: number;
  categories: Record<string, number>;
  testResults: Array<{ name: string; passed: boolean; error?: string }>;
  coveragePct: number;
  passCount: number;
  failCount: number;
  notes: string | null;
  createdAt: string;
}

export interface SkillImportEntry {
  id: string;
  sourceUrl: string | null;
  sourceType: ImportSourceType;
  skillName: string;
  importStatus: ImportStatus;
  importedBy: string | null;
  targetCategory: SkillCategory | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SkillGapReport {
  totalRegistered: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byTier: Record<string, number>;
  missingCategories: string[];
  lowCoverageSkills: Array<{ name: string; coveragePct: number }>;
  recommendations: string[];
}

// ── Constants ─────────────────────────────────────────────────
export const SKILL_CATEGORIES: SkillCategory[] = [
  'ai-agency', 'autonomous-economy', 'compute-mesh', 'design',
  'email-generic', 'marketing', 'notifications', 'ocr',
  'productivity', 'security', 'trading', 'data-engineering',
  'web-scraping', 'devops', 'research', 'quantum', 'automotive',
];

export const QUALITY_TIERS: QualityTier[] = [
  'experimental', 'beta', 'stable', 'certified',
];

export const INTEGRATION_STATUS_ORDER: IntegrationStatus[] = [
  'discovered', 'evaluating', 'adapting', 'testing', 'integrated',
];

export const DEFAULT_QUALITY_THRESHOLD = 70;

export const DEFAULT_SKILL_REGISTRY_CONFIG = {
  autoDiscover: true,
  qualityThreshold: 70,
  autoListOnMarketplace: true,
  importTimeoutS: 300,
  maxConcurrentImports: 5,
} as const;

// ── Utility functions ─────────────────────────────────────────

/** Check if a skill meets the quality threshold for promotion */
export function meetsQualityThreshold(
  score: number,
  threshold: number = DEFAULT_QUALITY_THRESHOLD,
): boolean {
  return score >= threshold;
}

/** Calculate gap score: 0 = fully covered category, 1 = no skills at all */
export function gapScore(
  categorySkillCount: number,
  targetPerCategory: number = 5,
): number {
  if (targetPerCategory <= 0) return 0;
  const ratio = categorySkillCount / targetPerCategory;
  return Math.max(0, Math.min(1, 1 - ratio));
}

/**
 * Compatibility score for imported skills (0-100).
 * Checks: has SKILL.md (+30), has actions (+20), has archetype (+15),
 * has pricing (+15), has tests (+20).
 */
export function compatibilityScore(entry: {
  hasSkillMd: boolean;
  hasActions: boolean;
  hasArchetype: boolean;
  hasPricing: boolean;
  hasTests: boolean;
}): number {
  let score = 0;
  if (entry.hasSkillMd) score += 30;
  if (entry.hasActions) score += 20;
  if (entry.hasArchetype) score += 15;
  if (entry.hasPricing) score += 15;
  if (entry.hasTests) score += 20;
  return score;
}

/** Determine quality tier based on assessment score */
export function tierFromScore(score: number): QualityTier {
  if (score >= 90) return 'certified';
  if (score >= 70) return 'stable';
  if (score >= 50) return 'beta';
  return 'experimental';
}

/** Check if integration status can advance to next step */
export function canAdvanceIntegration(
  current: IntegrationStatus,
  next: IntegrationStatus,
): boolean {
  if (current === 'deprecated') return false;
  const ci = INTEGRATION_STATUS_ORDER.indexOf(current);
  const ni = INTEGRATION_STATUS_ORDER.indexOf(next);
  if (ci === -1 || ni === -1) return false;
  return ni === ci + 1;
}

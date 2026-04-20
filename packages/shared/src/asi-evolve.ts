// ---------------------------------------------------------------------------
// ASI-Evolve — Self-Improvement Engine shared types
// ---------------------------------------------------------------------------
// Learn → Design → Experiment → Analyze loop. Sven continuously improves
// his own skills, prompts, workflows, and routing via evolutionary search,
// A/B testing, and controlled rollback.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------------ enums */

export type ImprovementDomain =
  | 'skill'
  | 'prompt'
  | 'workflow'
  | 'routing'
  | 'scheduling'
  | 'retrieval'
  | 'custom';

export type ImprovementPhase =
  | 'learn'
  | 'design'
  | 'experiment'
  | 'analyze'
  | 'applied'
  | 'rejected'
  | 'rolled_back';

export type ABExperimentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ABWinner = 'a' | 'b' | 'inconclusive';

export type RollbackTrigger = 'system' | 'human' | 'safety_guard' | 'regression';

/* -------------------------------------------------------------- interfaces */

export interface ImprovementProposal {
  id: string;
  orgId: string;
  domain: ImprovementDomain;
  phase: ImprovementPhase;
  title: string;
  description: string;
  currentMetric: Record<string, number>;
  proposedChange: Record<string, unknown>;
  expectedImpact: number;
  actualImpact: number | null;
  confidence: number;
  evolutionRunId: string | null;
  approvedBy: string | null;
  requiresHumanApproval: boolean;
  rollbackPlan: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  expiredAt: string | null;
}

export interface ABExperiment {
  id: string;
  proposalId: string;
  orgId: string;
  variantA: Record<string, unknown>;
  variantB: Record<string, unknown>;
  status: ABExperimentStatus;
  sampleSize: number;
  targetSamples: number;
  variantAWins: number;
  variantBWins: number;
  variantAScore: number;
  variantBScore: number;
  winner: ABWinner | null;
  significance: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RollbackRecord {
  id: string;
  proposalId: string;
  orgId: string;
  reason: string;
  rollbackData: Record<string, unknown>;
  previousState: Record<string, unknown>;
  restoredState: Record<string, unknown>;
  triggeredBy: RollbackTrigger;
  regressionMetric: string | null;
  regressionDelta: number | null;
  createdAt: string;
}

export interface EvolveConfig {
  autoPropose: boolean;
  requireHumanApprovalThreshold: number;
  abTargetSamples: number;
  maxConcurrentExperiments: number;
  rollbackOnRegression: boolean;
  regressionThreshold: number;
}

/* ---------------------------------------------------------- constants */

export const IMPROVEMENT_PHASE_ORDER: ImprovementPhase[] = [
  'learn',
  'design',
  'experiment',
  'analyze',
  'applied',
];

export const IMPROVEMENT_DOMAINS: ImprovementDomain[] = [
  'skill',
  'prompt',
  'workflow',
  'routing',
  'scheduling',
  'retrieval',
  'custom',
];

export const DEFAULT_EVOLVE_CONFIG: EvolveConfig = {
  autoPropose: true,
  requireHumanApprovalThreshold: 0.7,
  abTargetSamples: 100,
  maxConcurrentExperiments: 3,
  rollbackOnRegression: true,
  regressionThreshold: -0.05,
};

/* -------------------------------------------------------- utilities */

/**
 * Check whether a proposal can advance to the given next phase.
 * Follows the Learn → Design → Experiment → Analyze → Applied order.
 * Terminal phases (rejected, rolled_back) cannot advance.
 */
export function canAdvancePhase(current: ImprovementPhase, next: ImprovementPhase): boolean {
  if (current === 'rejected' || current === 'rolled_back') return false;
  if (next === 'rejected') return true; // can reject from any non-terminal phase
  if (next === 'rolled_back') return current === 'applied'; // only rollback applied

  const currentIdx = IMPROVEMENT_PHASE_ORDER.indexOf(current);
  const nextIdx = IMPROVEMENT_PHASE_ORDER.indexOf(next);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx === currentIdx + 1;
}

/**
 * Determine if a proposal's expected impact exceeds the threshold
 * requiring human approval.
 */
export function requiresApproval(
  proposal: Pick<ImprovementProposal, 'expectedImpact' | 'requiresHumanApproval'>,
  config: EvolveConfig = DEFAULT_EVOLVE_CONFIG,
): boolean {
  if (proposal.requiresHumanApproval) return true;
  return Math.abs(proposal.expectedImpact) >= config.requireHumanApprovalThreshold;
}

/**
 * Determine if an A/B experiment has reached statistical significance.
 * Uses a simplified z-test for proportions.
 */
export function isSignificant(experiment: ABExperiment, minSignificance = 0.95): boolean {
  if (experiment.sampleSize < 30) return false;
  const total = experiment.variantAWins + experiment.variantBWins;
  if (total === 0) return false;

  const pA = experiment.variantAWins / total;
  const pB = experiment.variantBWins / total;
  const pPool = (experiment.variantAWins + experiment.variantBWins) / (2 * total);
  const se = Math.sqrt(2 * pPool * (1 - pPool) / total);
  if (se === 0) return true;

  const z = Math.abs(pA - pB) / se;
  // z > 1.96 ≈ 95% confidence
  const confidence = z > 1.96 ? 0.95 + (z - 1.96) * 0.01 : z / 1.96 * 0.95;
  return confidence >= minSignificance;
}

/**
 * Determine the winner of an A/B experiment.
 */
export function determineWinner(experiment: ABExperiment): ABWinner {
  if (!isSignificant(experiment)) return 'inconclusive';
  if (experiment.variantAScore > experiment.variantBScore) return 'a';
  if (experiment.variantBScore > experiment.variantAScore) return 'b';
  return 'inconclusive';
}

/**
 * Check if a metric change constitutes a regression.
 */
export function isRegression(
  delta: number,
  config: EvolveConfig = DEFAULT_EVOLVE_CONFIG,
): boolean {
  return delta < config.regressionThreshold;
}

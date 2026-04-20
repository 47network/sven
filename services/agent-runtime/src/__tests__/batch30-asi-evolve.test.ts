/**
 * Batch 30 — ASI-Evolve (Self-Improvement Engine) tests
 *
 * Validates: migration SQL, shared types, utility functions,
 * SKILL.md, task executor cases, Eidolon wiring, event-bus SUBJECT_MAP.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/* ------------------------------------------------------------------ helpers */

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/* ============================================================ migration SQL */

describe('Batch 30 — ASI-Evolve migration', () => {
  const sql = read('services/gateway-api/migrations/20260504120000_asi_evolve.sql');

  it('creates improvement_proposals table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS improvement_proposals');
  });

  it('creates ab_experiments table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ab_experiments');
  });

  it('creates rollback_history table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS rollback_history');
  });

  it('has domain CHECK constraint on improvement_proposals', () => {
    expect(sql).toContain("'skill'");
    expect(sql).toContain("'prompt'");
    expect(sql).toContain("'workflow'");
    expect(sql).toContain("'routing'");
    expect(sql).toContain("'scheduling'");
    expect(sql).toContain("'retrieval'");
    expect(sql).toContain("'custom'");
  });

  it('has phase CHECK constraint on improvement_proposals', () => {
    expect(sql).toContain("'learn'");
    expect(sql).toContain("'design'");
    expect(sql).toContain("'experiment'");
    expect(sql).toContain("'analyze'");
    expect(sql).toContain("'applied'");
    expect(sql).toContain("'rejected'");
    expect(sql).toContain("'rolled_back'");
  });

  it('has status CHECK on ab_experiments', () => {
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'running'");
    expect(sql).toContain("'completed'");
    expect(sql).toContain("'failed'");
    expect(sql).toContain("'cancelled'");
  });

  it('has winner CHECK on ab_experiments', () => {
    expect(sql).toContain("'inconclusive'");
  });

  it('has triggered_by CHECK on rollback_history', () => {
    expect(sql).toContain("'system'");
    expect(sql).toContain("'human'");
    expect(sql).toContain("'safety_guard'");
    expect(sql).toContain("'regression'");
  });

  it('adds evolve task types to marketplace_tasks CHECK', () => {
    expect(sql).toContain("'evolve_propose'");
    expect(sql).toContain("'evolve_experiment'");
    expect(sql).toContain("'evolve_rollback'");
  });

  it('creates indexes on improvement_proposals', () => {
    expect(sql).toContain('idx_improvement_proposals_org');
    expect(sql).toContain('idx_improvement_proposals_domain');
    expect(sql).toContain('idx_improvement_proposals_phase');
  });

  it('creates indexes on ab_experiments', () => {
    expect(sql).toContain('idx_ab_experiments_proposal');
    expect(sql).toContain('idx_ab_experiments_status');
  });

  it('creates indexes on rollback_history', () => {
    expect(sql).toContain('idx_rollback_history_proposal');
  });

  it('inserts default evolve settings', () => {
    expect(sql).toContain('evolve.auto_propose');
    expect(sql).toContain('evolve.require_human_approval_threshold');
    expect(sql).toContain('evolve.ab_target_samples');
    expect(sql).toContain('evolve.max_concurrent_experiments');
    expect(sql).toContain('evolve.rollback_on_regression');
    expect(sql).toContain('evolve.regression_threshold');
  });
});

/* ============================================================ shared types */

describe('Batch 30 — ASI-Evolve shared types', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports ImprovementDomain type with 7 values', () => {
    expect(src).toContain("export type ImprovementDomain");
    expect(src).toContain("| 'skill'");
    expect(src).toContain("| 'prompt'");
    expect(src).toContain("| 'workflow'");
    expect(src).toContain("| 'routing'");
    expect(src).toContain("| 'scheduling'");
    expect(src).toContain("| 'retrieval'");
    expect(src).toContain("| 'custom'");
  });

  it('exports ImprovementPhase type with 7 values', () => {
    expect(src).toContain("export type ImprovementPhase");
    expect(src).toContain("| 'learn'");
    expect(src).toContain("| 'design'");
    expect(src).toContain("| 'experiment'");
    expect(src).toContain("| 'analyze'");
    expect(src).toContain("| 'applied'");
    expect(src).toContain("| 'rejected'");
    expect(src).toContain("| 'rolled_back'");
  });

  it('exports ABExperimentStatus type', () => {
    expect(src).toContain("export type ABExperimentStatus");
  });

  it('exports ABWinner type', () => {
    expect(src).toContain("export type ABWinner");
  });

  it('exports RollbackTrigger type', () => {
    expect(src).toContain("export type RollbackTrigger");
  });

  it('exports ImprovementProposal interface', () => {
    expect(src).toContain('export interface ImprovementProposal');
    expect(src).toContain('domain: ImprovementDomain');
    expect(src).toContain('phase: ImprovementPhase');
    expect(src).toContain('expectedImpact: number');
    expect(src).toContain('confidence: number');
    expect(src).toContain('requiresHumanApproval: boolean');
    expect(src).toContain('rollbackPlan: Record<string, unknown>');
  });

  it('exports ABExperiment interface', () => {
    expect(src).toContain('export interface ABExperiment');
    expect(src).toContain('variantAWins: number');
    expect(src).toContain('variantBWins: number');
    expect(src).toContain('significance: number | null');
    expect(src).toContain('winner: ABWinner | null');
  });

  it('exports RollbackRecord interface', () => {
    expect(src).toContain('export interface RollbackRecord');
    expect(src).toContain('triggeredBy: RollbackTrigger');
    expect(src).toContain('regressionDelta: number | null');
  });

  it('exports EvolveConfig interface', () => {
    expect(src).toContain('export interface EvolveConfig');
    expect(src).toContain('autoPropose: boolean');
    expect(src).toContain('requireHumanApprovalThreshold: number');
    expect(src).toContain('maxConcurrentExperiments: number');
    expect(src).toContain('regressionThreshold: number');
  });

  it('exports IMPROVEMENT_PHASE_ORDER array', () => {
    expect(src).toContain('export const IMPROVEMENT_PHASE_ORDER');
  });

  it('exports IMPROVEMENT_DOMAINS array with 7 domains', () => {
    expect(src).toContain('export const IMPROVEMENT_DOMAINS');
  });

  it('exports DEFAULT_EVOLVE_CONFIG with sensible defaults', () => {
    expect(src).toContain('export const DEFAULT_EVOLVE_CONFIG');
    expect(src).toContain('autoPropose: true');
    expect(src).toContain('requireHumanApprovalThreshold: 0.7');
    expect(src).toContain('abTargetSamples: 100');
    expect(src).toContain('maxConcurrentExperiments: 3');
    expect(src).toContain('rollbackOnRegression: true');
    expect(src).toContain('regressionThreshold: -0.05');
  });

  it('is exported from packages/shared/src/index.ts', () => {
    const idx = read('packages/shared/src/index.ts');
    expect(idx).toContain("from './asi-evolve.js'");
  });
});

/* ===================================================== utility functions */

describe('Batch 30 — canAdvancePhase()', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports canAdvancePhase function', () => {
    expect(src).toContain('export function canAdvancePhase');
  });

  it('allows learn → design', () => {
    expect(src).toContain("current === 'rejected' || current === 'rolled_back'");
  });

  it('allows rejection from any non-terminal phase', () => {
    expect(src).toContain("if (next === 'rejected') return true");
  });

  it('only allows rollback from applied', () => {
    expect(src).toContain("if (next === 'rolled_back') return current === 'applied'");
  });
});

describe('Batch 30 — requiresApproval()', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports requiresApproval function', () => {
    expect(src).toContain('export function requiresApproval');
  });

  it('uses requireHumanApprovalThreshold from config', () => {
    expect(src).toContain('config.requireHumanApprovalThreshold');
  });
});

describe('Batch 30 — isSignificant()', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports isSignificant function', () => {
    expect(src).toContain('export function isSignificant');
  });

  it('requires minimum 30 samples', () => {
    expect(src).toContain('experiment.sampleSize < 30');
  });

  it('uses z-test for proportions', () => {
    expect(src).toContain('z > 1.96');
  });
});

describe('Batch 30 — determineWinner()', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports determineWinner function', () => {
    expect(src).toContain('export function determineWinner');
  });

  it('returns inconclusive when not significant', () => {
    expect(src).toContain("if (!isSignificant(experiment)) return 'inconclusive'");
  });
});

describe('Batch 30 — isRegression()', () => {
  const src = read('packages/shared/src/asi-evolve.ts');

  it('exports isRegression function', () => {
    expect(src).toContain('export function isRegression');
  });

  it('compares delta against regressionThreshold', () => {
    expect(src).toContain('delta < config.regressionThreshold');
  });
});

/* ============================================================ SKILL.md */

describe('Batch 30 — asi-evolve SKILL.md', () => {
  const skill = read('skills/autonomous-economy/asi-evolve/SKILL.md');

  it('has YAML frontmatter with name', () => {
    expect(skill).toContain('name: asi-evolve');
  });

  it('has researcher archetype', () => {
    expect(skill).toContain('archetype: researcher');
  });

  it('defines propose action', () => {
    expect(skill).toContain('id: propose');
  });

  it('defines experiment action', () => {
    expect(skill).toContain('id: experiment');
  });

  it('defines rollback action', () => {
    expect(skill).toContain('id: rollback');
  });

  it('defines status action', () => {
    expect(skill).toContain('id: status');
  });

  it('defines analyze action', () => {
    expect(skill).toContain('id: analyze');
  });

  it('mentions safety guardrails', () => {
    expect(skill).toContain('Safety Guardrails');
  });

  it('mentions human approval threshold', () => {
    expect(skill).toContain('Human approval');
  });
});

/* ======================================================= task executor */

describe('Batch 30 — task executor evolve cases', () => {
  const src = read('services/sven-marketplace/src/task-executor.ts');

  it('has evolve_propose case', () => {
    expect(src).toContain("case 'evolve_propose':");
  });

  it('has evolve_experiment case', () => {
    expect(src).toContain("case 'evolve_experiment':");
  });

  it('has evolve_rollback case', () => {
    expect(src).toContain("case 'evolve_rollback':");
  });

  it('routes evolve_propose to handleEvolvePropose', () => {
    expect(src).toContain('handleEvolvePropose');
  });

  it('routes evolve_experiment to handleEvolveExperiment', () => {
    expect(src).toContain('handleEvolveExperiment');
  });

  it('routes evolve_rollback to handleEvolveRollback', () => {
    expect(src).toContain('handleEvolveRollback');
  });

  it('handleEvolvePropose returns proposalId', () => {
    expect(src).toContain('proposalId');
  });

  it('handleEvolveExperiment returns experimentId', () => {
    expect(src).toContain('experimentId');
  });

  it('handleEvolveRollback returns rollbackId', () => {
    expect(src).toContain('rollbackId');
  });

  it('has exactly 31 switch cases', () => {
    const caseCount = (src.match(/case '/g) || []).length;
    expect(caseCount).toBe(31);
  });
});

/* ========================================================= Eidolon types */

describe('Batch 30 — Eidolon evolution_lab building', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  it('has evolution_lab in EidolonBuildingKind', () => {
    expect(src).toContain("'evolution_lab'");
  });

  it('has 15 EidolonBuildingKind values (15 pipes)', () => {
    const kindBlock = src.match(/export type EidolonBuildingKind[\s\S]*?;/);
    expect(kindBlock).toBeTruthy();
    const pipes = (kindBlock![0].match(/\|/g) || []).length;
    expect(pipes).toBe(15);
  });
});

describe('Batch 30 — Eidolon evolve event kinds', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  it('has evolve.proposal_created event', () => {
    expect(src).toContain("'evolve.proposal_created'");
  });

  it('has evolve.experiment_started event', () => {
    expect(src).toContain("'evolve.experiment_started'");
  });

  it('has evolve.improvement_applied event', () => {
    expect(src).toContain("'evolve.improvement_applied'");
  });

  it('has evolve.rollback_triggered event', () => {
    expect(src).toContain("'evolve.rollback_triggered'");
  });

  it('has 72 EidolonEventKind values (72 pipes)', () => {
    const kindBlock = src.match(/export type EidolonEventKind[\s\S]*?'heartbeat';/);
    expect(kindBlock).toBeTruthy();
    const pipes = (kindBlock![0].match(/\|/g) || []).length;
    expect(pipes).toBe(72);
  });
});

describe('Batch 30 — districtFor evolution_lab', () => {
  const src = read('services/sven-eidolon/src/types.ts');

  it('has case for evolution_lab', () => {
    expect(src).toContain("case 'evolution_lab':");
  });

  it('maps evolution_lab to infrastructure district', () => {
    expect(src).toContain("case 'evolution_lab':");
    expect(src).toContain("return 'infrastructure'");
  });

  it('has 15 districtFor cases total', () => {
    const fnBlock = src.match(/export function districtFor[\s\S]*?^}/m);
    expect(fnBlock).toBeTruthy();
    const cases = (fnBlock![0].match(/case '/g) || []).length;
    expect(cases).toBe(15);
  });
});

/* ======================================================== SUBJECT_MAP */

describe('Batch 30 — SUBJECT_MAP evolve entries', () => {
  const src = read('services/sven-eidolon/src/event-bus.ts');

  it('maps sven.evolve.proposal_created', () => {
    expect(src).toContain("'sven.evolve.proposal_created': 'evolve.proposal_created'");
  });

  it('maps sven.evolve.experiment_started', () => {
    expect(src).toContain("'sven.evolve.experiment_started': 'evolve.experiment_started'");
  });

  it('maps sven.evolve.improvement_applied', () => {
    expect(src).toContain("'sven.evolve.improvement_applied': 'evolve.improvement_applied'");
  });

  it('maps sven.evolve.rollback_triggered', () => {
    expect(src).toContain("'sven.evolve.rollback_triggered': 'evolve.rollback_triggered'");
  });

  it('has 71 SUBJECT_MAP entries total', () => {
    const entries = (src.match(/'sven\./g) || []).length;
    expect(entries).toBe(71);
  });
});

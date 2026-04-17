/**
 * Evolution ↔ Automaton Bridge
 *
 * Connects the ASI-Evolve self-improvement loop (evolution-engine.ts) to the
 * Automaton lifecycle (automaton-lifecycle.ts) so that:
 *
 *  1. When an automaton is evaluated (tick), the bridge checks if an evolution
 *     run exists for the automaton's domain. If the run shows consistent
 *     improvement, the automaton gets an ROI bonus that can push it past the
 *     clone threshold.
 *
 *  2. The bridge can trigger a new evolution run for a working automaton,
 *     using the automaton's pipeline config as the experiment seed.
 *
 *  3. Evolution results influence clone metadata — a clone inherits the
 *     best-performing solution from the parent's evolution run.
 */

import { createLogger } from '@sven/shared';
import type { EvolutionRun, EvolutionNode } from './evolution-engine.js';
import { listRuns, getRun } from './evolution-engine.js';
import type { AutomatonRecord, LifecycleDecision, LifecycleThresholds } from './automaton-lifecycle.js';

const logger = createLogger('evolution-automaton-bridge');

/* ------------------------------------------------------------------ types */

export interface EvolutionSignal {
  runId: string;
  bestScore: number;
  generationsCompleted: number;
  improvementRate: number;
  bestNodeId: string | null;
}

export interface BridgeAdjustment {
  roiBonus: number;
  reason: string;
  signal: EvolutionSignal | null;
}

export interface BridgeConfig {
  /** Minimum generations before the bridge considers evolution results. Default 3. */
  minGenerationsForSignal: number;
  /** Score improvement rate (per generation) that triggers an ROI bonus. Default 0.05. */
  improvementRateThreshold: number;
  /** Maximum ROI bonus from evolution. Default 0.5 (50% of cost). */
  maxRoiBonus: number;
  /** ROI bonus per 0.01 improvement rate above threshold. Default 0.1. */
  roiBonusPerImprovement: number;
}

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  minGenerationsForSignal: 3,
  improvementRateThreshold: 0.05,
  maxRoiBonus: 0.5,
  roiBonusPerImprovement: 0.1,
};

/* ------------------------------------------------------------------ core */

/**
 * Find the most relevant evolution run for an automaton.
 * Matches by orgId and looks for runs tagged with the automaton's id in metadata.
 */
export function findEvolutionRunForAutomaton(
  automatonId: string,
  orgId: string,
): EvolutionRun | null {
  const runs = listRuns(50);
  // First: exact match by automaton id in run metadata or experiment name
  for (const run of runs) {
    if (run.orgId !== orgId) continue;
    if (
      run.experiment.name.includes(automatonId) ||
      run.experiment.description.includes(automatonId)
    ) {
      return run;
    }
  }
  // Second: any completed/running run for the same org (most recent)
  for (const run of runs) {
    if (run.orgId !== orgId) continue;
    if (run.status === 'completed' || run.status === 'running') {
      return run;
    }
  }
  return null;
}

/**
 * Compute the improvement rate of an evolution run by comparing the best
 * score of each generation. Returns the average score delta per generation.
 */
export function computeImprovementRate(nodes: EvolutionNode[]): number {
  if (nodes.length < 2) return 0;

  // Group nodes by generation and find best score per generation
  const genBest = new Map<number, number>();
  for (const node of nodes) {
    const current = genBest.get(node.generation);
    if (current === undefined || node.score > current) {
      genBest.set(node.generation, node.score);
    }
  }

  const generations = [...genBest.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, score]) => score);

  if (generations.length < 2) return 0;

  // Average score delta between consecutive generations
  let totalDelta = 0;
  for (let i = 1; i < generations.length; i++) {
    totalDelta += generations[i] - generations[i - 1];
  }
  return totalDelta / (generations.length - 1);
}

/**
 * Extract an evolution signal from a run for an automaton.
 */
export function extractSignal(
  run: EvolutionRun,
  config: BridgeConfig = DEFAULT_BRIDGE_CONFIG,
): EvolutionSignal | null {
  if (run.currentGeneration < config.minGenerationsForSignal) return null;
  const improvementRate = computeImprovementRate(run.nodes);
  return {
    runId: run.id,
    bestScore: run.bestScore,
    generationsCompleted: run.currentGeneration,
    improvementRate,
    bestNodeId: run.bestNodeId,
  };
}

/**
 * Compute the ROI adjustment for an automaton based on its evolution signal.
 * A positive improvement rate above threshold earns a bonus.
 * A negative improvement rate earns a penalty (clamped to -0.2).
 */
export function computeAdjustment(
  signal: EvolutionSignal | null,
  config: BridgeConfig = DEFAULT_BRIDGE_CONFIG,
): BridgeAdjustment {
  if (!signal) {
    return { roiBonus: 0, reason: 'no evolution signal', signal: null };
  }

  if (signal.improvementRate >= config.improvementRateThreshold) {
    const excessRate = signal.improvementRate - config.improvementRateThreshold;
    const rawBonus = (excessRate / 0.01) * config.roiBonusPerImprovement;
    const bonus = Math.min(rawBonus, config.maxRoiBonus);
    return {
      roiBonus: bonus,
      reason: `evolution improving at ${(signal.improvementRate * 100).toFixed(1)}%/gen → +${bonus.toFixed(2)} ROI bonus`,
      signal,
    };
  }

  if (signal.improvementRate < 0) {
    const penalty = Math.max(signal.improvementRate * 2, -0.2);
    return {
      roiBonus: penalty,
      reason: `evolution regressing at ${(signal.improvementRate * 100).toFixed(1)}%/gen → ${penalty.toFixed(2)} ROI penalty`,
      signal,
    };
  }

  return {
    roiBonus: 0,
    reason: `evolution improving slowly (${(signal.improvementRate * 100).toFixed(1)}%/gen < threshold ${(config.improvementRateThreshold * 100).toFixed(1)}%)`,
    signal,
  };
}

/**
 * High-level bridge call: given an automaton + its lifecycle decision,
 * compute evolution-adjusted ROI. Returns the original decision enriched
 * with evolution metadata.
 */
export function adjustDecisionWithEvolution(
  automaton: AutomatonRecord,
  decision: LifecycleDecision,
  config: BridgeConfig = DEFAULT_BRIDGE_CONFIG,
): LifecycleDecision & { evolutionAdjustment?: BridgeAdjustment } {
  const run = findEvolutionRunForAutomaton(automaton.id, automaton.orgId);
  if (!run) {
    return { ...decision, evolutionAdjustment: { roiBonus: 0, reason: 'no evolution run found', signal: null } };
  }

  const signal = extractSignal(run, config);
  const adjustment = computeAdjustment(signal, config);

  if (adjustment.roiBonus === 0) {
    return { ...decision, evolutionAdjustment: adjustment };
  }

  const adjustedRoi = decision.roi + adjustment.roiBonus;
  logger.info('evolution bridge adjusting ROI', {
    automatonId: automaton.id,
    originalRoi: decision.roi,
    adjustedRoi,
    bonus: adjustment.roiBonus,
    reason: adjustment.reason,
  });

  return {
    ...decision,
    roi: adjustedRoi,
    reason: `${decision.reason} | evolution: ${adjustment.reason}`,
    evolutionAdjustment: adjustment,
  };
}

/**
 * Get the best solution code from an evolution run, suitable for
 * passing to a clone's metadata so it inherits its parent's best
 * evolutionary output.
 */
export function getBestSolutionForClone(
  automatonId: string,
  orgId: string,
): { code: string; score: number; runId: string } | null {
  const run = findEvolutionRunForAutomaton(automatonId, orgId);
  if (!run || !run.bestNodeId) return null;
  const bestNode = run.nodes.find((n) => n.id === run.bestNodeId);
  if (!bestNode) return null;
  return {
    code: bestNode.code,
    score: bestNode.score,
    runId: run.id,
  };
}

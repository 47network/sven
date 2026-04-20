/**
 * Tests for Batch 7 modules:
 * - economy-context-prompt (buildEconomyContextPrompt, gatherEconomySnapshot)
 * - evolution-automaton-bridge (computeImprovementRate, extractSignal, computeAdjustment, adjustDecisionWithEvolution)
 * - economy-digest (formatDigest, buildDigest)
 */

/* ================================================================
 *  economy-context-prompt
 * ================================================================ */
import { gatherEconomySnapshot, buildEconomyContextPrompt, type EconomySnapshot } from '../economy-context-prompt.js';

// Minimal mock pg pool
function mockPool(queryResults: Record<string, { rows: Record<string, unknown>[] }>): any {
  return {
    query: jest.fn(async (sql: string) => {
      for (const [fragment, result] of Object.entries(queryResults)) {
        if (sql.includes(fragment)) return result;
      }
      throw new Error(`Unexpected query: ${sql.slice(0, 60)}`);
    }),
  };
}

describe('gatherEconomySnapshot', () => {
  it('returns zeros when tables are missing', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('relation does not exist')),
    };
    const snap = await gatherEconomySnapshot(pool as any);
    expect(snap.treasuryAccounts).toBe(0);
    expect(snap.activeAutomatons).toBe(0);
    expect(snap.activePipelines).toBe(0);
    expect(snap.revenue24hUsd).toBe(0);
    expect(snap.marketplaceListings).toBe(0);
  });

  it('populates from real query results', async () => {
    const pool = mockPool({
      treasury_accounts: { rows: [{ count: 2, total_balance: '150.75' }] },
      automatons: { rows: [{ status: 'working', count: 3 }, { status: 'retiring', count: 1 }] },
      revenue_pipelines: { rows: [{ total: 5, seeds: 2 }] },
      revenue_events: { rows: [{ net_24h: '42.50' }] },
      marketplace_listings: { rows: [{ count: 7 }] },
    });
    const snap = await gatherEconomySnapshot(pool);
    expect(snap.treasuryAccounts).toBe(2);
    expect(snap.totalBalanceUsd).toBe(150.75);
    expect(snap.workingAutomatons).toBe(3);
    expect(snap.retiringAutomatons).toBe(1);
    expect(snap.activeAutomatons).toBe(4);
    expect(snap.activePipelines).toBe(5);
    expect(snap.seedPipelines).toBe(2);
    expect(snap.revenue24hUsd).toBe(42.50);
    expect(snap.marketplaceListings).toBe(7);
  });
});

describe('buildEconomyContextPrompt', () => {
  it('returns empty string when economy is empty', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('no table')),
    };
    const result = await buildEconomyContextPrompt(pool as any);
    expect(result).toBe('');
  });

  it('returns formatted prompt with economy data', async () => {
    const pool = mockPool({
      treasury_accounts: { rows: [{ count: 1, total_balance: '50.00' }] },
      automatons: { rows: [{ status: 'working', count: 2 }] },
      revenue_pipelines: { rows: [{ total: 3, seeds: 1 }] },
      revenue_events: { rows: [{ net_24h: '10.00' }] },
      marketplace_listings: { rows: [{ count: 0 }] },
    });
    const result = await buildEconomyContextPrompt(pool);
    expect(result).toContain('Your Autonomous Economy:');
    expect(result).toContain('Treasury: 1 account(s), $50.00');
    expect(result).toContain('Revenue pipelines: 3 active (1 seed)');
    expect(result).toContain('+$10.00');
    expect(result).toContain('/economy status');
  });
});

/* ================================================================
 *  evolution-automaton-bridge
 * ================================================================ */
import {
  computeImprovementRate,
  extractSignal,
  computeAdjustment,
  adjustDecisionWithEvolution,
  type BridgeConfig,
} from '../evolution-automaton-bridge.js';
import type { EvolutionNode, EvolutionRun } from '../evolution-engine.js';
import type { AutomatonRecord, LifecycleDecision } from '../automaton-lifecycle.js';

function makeNode(gen: number, score: number): EvolutionNode {
  return {
    id: `node-${gen}-${score}`,
    runId: 'run-1',
    parentId: null,
    generation: gen,
    code: 'test code',
    score,
    metrics: {},
    analysis: '',
    visits: 1,
    createdAt: new Date().toISOString(),
  };
}

function makeRun(overrides: Partial<EvolutionRun> = {}): EvolutionRun {
  return {
    id: 'run-1',
    orgId: 'org-1',
    experiment: {
      name: 'test-exp',
      description: 'automaton-1',
      domain: 'custom',
      evaluatorCode: '',
      baselineCode: '',
      cognitionSeeds: [],
      config: {},
    },
    config: {
      maxGenerations: 10,
      populationSize: 5,
      mutationRate: 0.1,
      eliteCount: 1,
      samplingStrategy: 'ucb1',
      explorationWeight: 1.4,
      timeoutMs: 60000,
      evaluatorTimeoutMs: 30000,
      parallelWorkers: 1,
    },
    status: 'completed',
    currentGeneration: 5,
    bestScore: 0.9,
    bestNodeId: 'node-4-0.9',
    nodes: [makeNode(0, 0.5), makeNode(1, 0.6), makeNode(2, 0.7), makeNode(3, 0.8), makeNode(4, 0.9)],
    cognition: [],
    totalEvaluations: 5,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeImprovementRate', () => {
  it('returns 0 for fewer than 2 nodes', () => {
    expect(computeImprovementRate([])).toBe(0);
    expect(computeImprovementRate([makeNode(0, 0.5)])).toBe(0);
  });

  it('computes average per-generation improvement', () => {
    const nodes = [makeNode(0, 0.5), makeNode(1, 0.6), makeNode(2, 0.7), makeNode(3, 0.8)];
    const rate = computeImprovementRate(nodes);
    expect(rate).toBeCloseTo(0.1, 5);
  });

  it('handles regression', () => {
    const nodes = [makeNode(0, 0.8), makeNode(1, 0.7), makeNode(2, 0.6)];
    const rate = computeImprovementRate(nodes);
    expect(rate).toBeCloseTo(-0.1, 5);
  });
});

describe('extractSignal', () => {
  it('returns null for too few generations', () => {
    const run = makeRun({ currentGeneration: 2 });
    const signal = extractSignal(run);
    expect(signal).toBeNull();
  });

  it('returns signal with improvement rate for sufficient generations', () => {
    const run = makeRun();
    const signal = extractSignal(run);
    expect(signal).not.toBeNull();
    expect(signal!.runId).toBe('run-1');
    expect(signal!.bestScore).toBe(0.9);
    expect(signal!.improvementRate).toBeCloseTo(0.1, 5);
  });
});

describe('computeAdjustment', () => {
  const config: BridgeConfig = {
    minGenerationsForSignal: 3,
    improvementRateThreshold: 0.05,
    maxRoiBonus: 0.5,
    roiBonusPerImprovement: 0.1,
  };

  it('returns 0 bonus for null signal', () => {
    const adj = computeAdjustment(null, config);
    expect(adj.roiBonus).toBe(0);
    expect(adj.reason).toContain('no evolution signal');
  });

  it('gives bonus for high improvement rate', () => {
    const signal = extractSignal(makeRun())!;
    const adj = computeAdjustment(signal, config);
    expect(adj.roiBonus).toBeGreaterThan(0);
    expect(adj.reason).toContain('improving');
  });

  it('gives penalty for regression', () => {
    const run = makeRun({
      nodes: [makeNode(0, 0.8), makeNode(1, 0.7), makeNode(2, 0.6), makeNode(3, 0.5), makeNode(4, 0.4)],
    });
    const signal = extractSignal(run)!;
    const adj = computeAdjustment(signal, config);
    expect(adj.roiBonus).toBeLessThan(0);
    expect(adj.reason).toContain('regressing');
  });

  it('caps bonus at maxRoiBonus', () => {
    const hugeNodes = Array.from({ length: 10 }, (_, i) => makeNode(i, i * 0.5));
    const run = makeRun({
      currentGeneration: 10,
      nodes: hugeNodes,
      bestScore: 4.5,
    });
    const signal = extractSignal(run)!;
    const adj = computeAdjustment(signal, config);
    expect(adj.roiBonus).toBeLessThanOrEqual(config.maxRoiBonus);
  });
});

describe('adjustDecisionWithEvolution', () => {
  const automaton: AutomatonRecord = {
    id: 'automaton-1',
    orgId: 'org-1',
    parentId: null,
    generation: 0,
    status: 'working',
    bornAt: new Date().toISOString(),
    retiredAt: null,
    diedAt: null,
    treasuryAccountId: 'ta-1',
    walletId: null,
    pipelineIds: ['p-1'],
    metadata: {},
    metrics: {
      lifetimeRevenueUsd: 100,
      lifetimeCostUsd: 50,
      lastRoi: 2.0,
      lastEvaluatedAt: new Date().toISOString(),
      lastInflowAt: new Date().toISOString(),
      cloneCount: 0,
    },
  };

  const decision: LifecycleDecision = {
    automatonId: 'automaton-1',
    previousStatus: 'working',
    nextStatus: 'working',
    roi: 1.2,
    reason: 'ROI 1.20 within band',
    revenueUsd: 100,
    costUsd: 50,
  };

  it('returns decision unchanged when no evolution run found', () => {
    const adjusted = adjustDecisionWithEvolution(automaton, decision);
    expect(adjusted.roi).toBe(1.2);
    expect(adjusted.evolutionAdjustment).toBeDefined();
    expect(adjusted.evolutionAdjustment!.roiBonus).toBe(0);
  });
});

/* ================================================================
 *  economy-digest
 * ================================================================ */
import { formatDigest, buildDigest, type DigestReport } from '../economy-digest.js';
import type { EconomySnapshot as SnapType } from '../economy-context-prompt.js';

describe('formatDigest', () => {
  const snap: SnapType = {
    treasuryAccounts: 2,
    totalBalanceUsd: 250.50,
    activeAutomatons: 5,
    workingAutomatons: 3,
    cloningAutomatons: 1,
    retiringAutomatons: 1,
    activePipelines: 4,
    revenue24hUsd: 35.00,
    marketplaceListings: 3,
    seedPipelines: 2,
  };

  it('produces a formatted report', () => {
    const report = formatDigest(snap, 'org-1');
    expect(report.orgId).toBe('org-1');
    expect(report.snapshot).toEqual(snap);
    expect(report.formattedText).toContain('SVEN ECONOMY DIGEST');
    expect(report.formattedText).toContain('Balance:  $250.50');
    expect(report.formattedText).toContain('Active:   5 total');
    expect(report.formattedText).toContain('Active pipelines: 4 (2 seed)');
    expect(report.formattedText).toContain('+$35.00');
    expect(report.formattedText).toContain('Active listings: 3');
  });

  it('generates appropriate highlights', () => {
    const report = formatDigest(snap, 'org-1');
    expect(report.highlights.length).toBeGreaterThan(0);
    // Should highlight cloning in progress
    expect(report.highlights.some(h => h.includes('cloning'))).toBe(true);
    // Should highlight positive revenue
    expect(report.highlights.some(h => h.includes('Positive revenue'))).toBe(true);
  });

  it('highlights when treasury is above $100', () => {
    const report = formatDigest(snap, 'org-1');
    expect(report.highlights.some(h => h.includes('exceeds $100'))).toBe(true);
  });

  it('highlights when treasury is near zero', () => {
    const lowSnap = { ...snap, totalBalanceUsd: 0.50 };
    const report = formatDigest(lowSnap, 'org-1');
    expect(report.highlights.some(h => h.includes('near zero'))).toBe(true);
  });
});

describe('buildDigest', () => {
  it('builds from pool data', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('no table')),
    };
    const report = await buildDigest(pool as any, 'org-1');
    expect(report.orgId).toBe('org-1');
    expect(report.formattedText).toContain('SVEN ECONOMY DIGEST');
    // All zeros since tables don't exist
    expect(report.snapshot.treasuryAccounts).toBe(0);
  });
});

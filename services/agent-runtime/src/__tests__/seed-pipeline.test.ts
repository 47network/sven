// ---------------------------------------------------------------------------
// Batch 6 — Seed Pipeline Provisioner + makeRevenuePg tests
// ---------------------------------------------------------------------------
import { SeedPipelineProvisioner } from '../seed-pipeline-provisioner';
import { makeRevenuePg } from '../automaton-adapters';
import type { RevenuePipelineRepository } from '../revenue-pipeline-repo';
import type { RevenuePipeline, PipelineConfig, PipelineMetrics } from '../revenue-pipeline-repo';

/* ------------------------------------------------------------------ mocks */

function fakePipeline(overrides: Partial<RevenuePipeline> = {}): RevenuePipeline {
  return {
    id: overrides.id ?? 'pipe_1',
    orgId: overrides.orgId ?? 'org_1',
    name: overrides.name ?? 'Test pipeline',
    type: overrides.type ?? 'service_marketplace',
    status: overrides.status ?? 'active',
    config: {
      treasuryAccountId: 'acct_1',
      payoutSchedule: 'daily',
      minPayoutThreshold: 1,
      platformFeePct: 2.9,
      reinvestPct: 30,
      typeConfig: {},
      ...(overrides.config ?? {}),
    } as PipelineConfig,
    metrics: {
      totalRevenue: 0,
      totalFees: 0,
      netRevenue: 0,
      totalPayouts: 0,
      pendingPayout: 0,
      transactionCount: 0,
      avgTransactionSize: 0,
      lastDayRevenue: 0,
      last7DayRevenue: 0,
      last30DayRevenue: 0,
      ...(overrides.metrics ?? {}),
    } as PipelineMetrics,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    lastRevenueAt: overrides.lastRevenueAt ?? null,
  };
}

function mockRepo(overrides: Partial<RevenuePipelineRepository> = {}): RevenuePipelineRepository {
  return {
    createPipeline: jest.fn().mockResolvedValue(fakePipeline()),
    activatePipeline: jest.fn().mockResolvedValue(fakePipeline()),
    findActiveByTreasuryAccount: jest.fn().mockResolvedValue([]),
    sumNetInflowByTreasurySince: jest.fn().mockResolvedValue(0),
    seedServiceMarketplacePipeline: jest.fn().mockResolvedValue(fakePipeline()),
    ...overrides,
  } as unknown as RevenuePipelineRepository;
}

/* ========================================================================
   SeedPipelineProvisioner
   ======================================================================== */

describe('SeedPipelineProvisioner', () => {
  const baseParams = {
    orgId: 'org_1',
    automatonId: 'auto_42',
    treasuryAccountId: 'acct_1',
  };

  it('provisions a new seed pipeline on fresh birth', async () => {
    const repo = mockRepo();
    const provisioner = new SeedPipelineProvisioner({ repo });

    const result = await provisioner.provisionForAutomaton(baseParams);

    expect(repo.findActiveByTreasuryAccount).toHaveBeenCalledWith('acct_1');
    expect(repo.seedServiceMarketplacePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_1',
        automatonId: 'auto_42',
        treasuryAccountId: 'acct_1',
      }),
    );
    expect(result).toEqual({ pipelineId: 'pipe_1', pipelineName: 'Test pipeline' });
  });

  it('returns existing pipeline when one matches (idempotency)', async () => {
    const existing = fakePipeline({
      id: 'existing_seed',
      name: 'Seed pipeline — automaton auto_42',
      config: {
        treasuryAccountId: 'acct_1',
        payoutSchedule: 'daily',
        minPayoutThreshold: 1,
        platformFeePct: 2.9,
        reinvestPct: 30,
        typeConfig: { automatonId: 'auto_42', seed: true },
      },
    });

    const repo = mockRepo({
      findActiveByTreasuryAccount: jest.fn().mockResolvedValue([existing]),
    });
    const provisioner = new SeedPipelineProvisioner({ repo });

    const result = await provisioner.provisionForAutomaton(baseParams);

    expect(result).toEqual({ pipelineId: 'existing_seed', pipelineName: existing.name });
    expect(repo.seedServiceMarketplacePipeline).not.toHaveBeenCalled();
  });

  it('does NOT reuse pipeline from different automaton', async () => {
    const otherAutomaton = fakePipeline({
      id: 'other_seed',
      config: {
        treasuryAccountId: 'acct_1',
        payoutSchedule: 'daily',
        minPayoutThreshold: 1,
        platformFeePct: 2.9,
        reinvestPct: 30,
        typeConfig: { automatonId: 'auto_99', seed: true },
      },
    });

    const repo = mockRepo({
      findActiveByTreasuryAccount: jest.fn().mockResolvedValue([otherAutomaton]),
    });
    const provisioner = new SeedPipelineProvisioner({ repo });

    await provisioner.provisionForAutomaton(baseParams);

    expect(repo.seedServiceMarketplacePipeline).toHaveBeenCalled();
  });

  it('applies custom name template', async () => {
    const repo = mockRepo();
    const provisioner = new SeedPipelineProvisioner({
      repo,
      nameTemplate: 'Revenue — {orgId}/{automatonId}',
    });

    await provisioner.provisionForAutomaton(baseParams);

    const call = (repo.seedServiceMarketplacePipeline as jest.Mock).mock.calls[0][0];
    expect(call.name).toBe('Revenue — org_1/auto_42');
  });

  it('throws on missing required params', async () => {
    const repo = mockRepo();
    const provisioner = new SeedPipelineProvisioner({ repo });

    await expect(provisioner.provisionForAutomaton({ ...baseParams, orgId: '' }))
      .rejects.toThrow('orgId required');
    await expect(provisioner.provisionForAutomaton({ ...baseParams, automatonId: '' }))
      .rejects.toThrow('automatonId required');
    await expect(provisioner.provisionForAutomaton({ ...baseParams, treasuryAccountId: '' }))
      .rejects.toThrow('treasuryAccountId required');
  });
});

/* ========================================================================
   makeRevenuePg adapter
   ======================================================================== */

describe('makeRevenuePg', () => {
  it('returns net inflow from repo', async () => {
    const repo = mockRepo({
      sumNetInflowByTreasurySince: jest.fn().mockResolvedValue(42.5),
    });
    const port = makeRevenuePg({ repo });

    const result = await port.netInflowSince('acct_1', new Date().toISOString());
    expect(result).toBe(42.5);
    expect(repo.sumNetInflowByTreasurySince).toHaveBeenCalled();
  });

  it('returns active pipeline ids from repo', async () => {
    const p1 = fakePipeline({ id: 'p_a' });
    const p2 = fakePipeline({ id: 'p_b' });
    const repo = mockRepo({
      findActiveByTreasuryAccount: jest.fn().mockResolvedValue([p1, p2]),
    });
    const port = makeRevenuePg({ repo });

    const ids = await port.activePipelineIds('acct_1');
    expect(ids).toEqual(['p_a', 'p_b']);
  });

  it('falls back to treasury_transactions when pipeline inflow is 0 and pool given', async () => {
    const repo = mockRepo({
      sumNetInflowByTreasurySince: jest.fn().mockResolvedValue(0),
    });
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ net: '100.25' }] }),
    };
    const port = makeRevenuePg({ repo, pool: mockPool as any });

    const result = await port.netInflowSince('acct_1', '2025-01-01T00:00:00Z');
    expect(result).toBe(100.25);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('treasury_transactions'),
      ['acct_1', '2025-01-01T00:00:00Z'],
    );
  });

  it('returns 0 when no pipeline inflow and no pool', async () => {
    const repo = mockRepo({
      sumNetInflowByTreasurySince: jest.fn().mockResolvedValue(0),
    });
    const port = makeRevenuePg({ repo });

    const result = await port.netInflowSince('acct_1', '2025-01-01T00:00:00Z');
    expect(result).toBe(0);
  });

  it('returns empty array for empty treasury account', async () => {
    const repo = mockRepo({
      findActiveByTreasuryAccount: jest.fn().mockResolvedValue([]),
    });
    const port = makeRevenuePg({ repo });

    const ids = await port.activePipelineIds('acct_nonexistent');
    expect(ids).toEqual([]);
  });
});

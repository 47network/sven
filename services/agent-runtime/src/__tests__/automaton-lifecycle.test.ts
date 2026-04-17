import {
  AutomatonLifecycle,
  type AutomatonRecord,
  type AutomatonStatus,
  type ClonePort,
  type InfraPort,
  type LifecycleClock,
  type RevenuePort,
  type StorePort,
  type TreasuryPort,
} from '../automaton-lifecycle';

class MemStore implements StorePort {
  readonly byId = new Map<string, AutomatonRecord>();
  async insert(r: AutomatonRecord) { this.byId.set(r.id, r); }
  async update(r: AutomatonRecord) { this.byId.set(r.id, r); }
  async get(id: string) { return this.byId.get(id) ?? null; }
  async listByStatus(orgId: string, status: AutomatonStatus) {
    return [...this.byId.values()].filter((r) => r.orgId === orgId && r.status === status);
  }
  async listAll(orgId: string) {
    return [...this.byId.values()].filter((r) => r.orgId === orgId);
  }
}

class FakeTreasury implements TreasuryPort {
  private n = 0;
  balances = new Map<string, number>();
  async openAccount() {
    const id = `acct_${++this.n}`;
    this.balances.set(id, 0);
    return { accountId: id };
  }
  async getAccountBalance(id: string) {
    return { balanceUsd: this.balances.get(id) ?? 0 };
  }
  async createWallet() {
    return { walletId: `wal_${++this.n}` };
  }
}

class FakeRevenue implements RevenuePort {
  inflow = new Map<string, number>();
  async netInflowSince(acct: string) {
    return this.inflow.get(acct) ?? 0;
  }
  async activePipelineIds() {
    return [];
  }
}

class FakeInfra implements InfraPort {
  cost = new Map<string, number>();
  decommissioned: string[] = [];
  async costSince(id: string) {
    return this.cost.get(id) ?? 0;
  }
  async decommission(id: string) {
    this.decommissioned.push(id);
  }
}

class FakeClone implements ClonePort {
  calls = 0;
  veto = false;
  async spawnDescendant() {
    this.calls += 1;
    if (this.veto) return null;
    return { pipelineIds: ['pl_child'], metadata: { spawned: true } };
  }
}

class MockClock implements LifecycleClock {
  private _now: Date;
  private seq = 0;
  constructor(start = new Date('2025-01-01T00:00:00Z')) { this._now = new Date(start); }
  now() { return new Date(this._now); }
  newId() { this.seq += 1; return `aut_test_${this.seq}`; }
  advanceMs(ms: number) { this._now = new Date(this._now.getTime() + ms); }
}

import type { LifecycleThresholds } from '../automaton-lifecycle';

function makeHarness(overrides: { thresholds?: Partial<LifecycleThresholds> } = {}) {
  const store = new MemStore();
  const treasury = new FakeTreasury();
  const revenue = new FakeRevenue();
  const infra = new FakeInfra();
  const clone = new FakeClone();
  const clock = new MockClock();
  const lifecycle = new AutomatonLifecycle({
    store, treasury, revenue, infra, clone, clock,
    thresholds: overrides.thresholds,
  });
  return { lifecycle, store, treasury, revenue, infra, clone, clock };
}

describe('automaton-lifecycle', () => {
  it('births an automaton with a fresh treasury account + wallet', async () => {
    const { lifecycle } = makeHarness();
    const rec = await lifecycle.birth({ orgId: 'org1' });
    expect(rec.status).toBe('born');
    expect(rec.treasuryAccountId).toMatch(/^acct_/);
    expect(rec.walletId).toMatch(/^wal_/);
    expect(rec.generation).toBe(0);
    expect(rec.parentId).toBeNull();
  });

  it('stays in probation until probationMs elapses', async () => {
    const { lifecycle, clock, revenue, infra } = makeHarness({
      thresholds: { probationMs: 60_000, evaluationMinRevenueUsd: 1 },
    });
    const rec = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(rec.treasuryAccountId, 100);
    infra.cost.set(rec.id, 10);
    clock.advanceMs(30_000);
    const d = await lifecycle.evaluate(rec.id);
    expect(d?.nextStatus).toBe('working');
    expect(d?.reason).toMatch(/probation/);
  });

  it('clones when ROI exceeds cloneRoi', async () => {
    const { lifecycle, clock, revenue, infra, clone, store } = makeHarness({
      thresholds: { probationMs: 10, cloneRoi: 2, retireRoi: 0.5, evaluationMinRevenueUsd: 1 },
    });
    const parent = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(parent.treasuryAccountId, 100);
    infra.cost.set(parent.id, 20);
    clock.advanceMs(60_000);
    const d = await lifecycle.evaluate(parent.id);
    expect(d?.nextStatus).toBe('cloning');
    await lifecycle.applyDecision(d!);
    expect(clone.calls).toBe(1);
    const all = await store.listAll('org1');
    expect(all.length).toBe(2);
    const child = all.find((a) => a.parentId === parent.id);
    expect(child?.generation).toBe(1);
    expect(child?.status).toBe('working');
  });

  it('retires when ROI below retireRoi after probation', async () => {
    const { lifecycle, clock, revenue, infra } = makeHarness({
      thresholds: { probationMs: 10, cloneRoi: 2, retireRoi: 0.5, evaluationMinRevenueUsd: 1 },
    });
    const rec = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(rec.treasuryAccountId, 5);
    infra.cost.set(rec.id, 100);
    clock.advanceMs(60_000);
    const d = await lifecycle.evaluate(rec.id);
    expect(d?.nextStatus).toBe('retiring');
    expect(d?.roi).toBeCloseTo(0.05);
  });

  it('transitions retiring -> dead after grace with no inflow and decommissions infra', async () => {
    const { lifecycle, clock, revenue, infra } = makeHarness({
      thresholds: {
        probationMs: 10,
        cloneRoi: 2,
        retireRoi: 0.5,
        evaluationMinRevenueUsd: 1,
        retireGraceMs: 30_000,
      },
    });
    const rec = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(rec.treasuryAccountId, 0);
    infra.cost.set(rec.id, 50);
    clock.advanceMs(60_000);
    const d1 = await lifecycle.evaluate(rec.id);
    expect(d1?.nextStatus).toBe('retiring');
    clock.advanceMs(60_000);
    const d2 = await lifecycle.evaluate(rec.id);
    expect(d2?.nextStatus).toBe('dead');
    await lifecycle.applyDecision(d2!);
    expect(infra.decommissioned).toContain(rec.id);
  });

  it('respects maxCloneCount', async () => {
    const { lifecycle, clock, revenue, infra, store } = makeHarness({
      thresholds: { probationMs: 10, cloneRoi: 2, retireRoi: 0.5, evaluationMinRevenueUsd: 1, maxCloneCount: 1 },
    });
    const parent = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(parent.treasuryAccountId, 100);
    infra.cost.set(parent.id, 20);
    clock.advanceMs(60_000);
    const d1 = await lifecycle.evaluate(parent.id);
    await lifecycle.applyDecision(d1!);
    clock.advanceMs(60_000);
    const d2 = await lifecycle.evaluate(parent.id);
    await lifecycle.applyDecision(d2!);
    const fresh = await store.get(parent.id);
    expect(fresh?.metrics.cloneCount).toBe(1);
  });

  it('tick evaluates all non-dead automata for an org', async () => {
    const { lifecycle, clock, revenue, infra } = makeHarness({
      thresholds: { probationMs: 10, cloneRoi: 2, retireRoi: 0.5, evaluationMinRevenueUsd: 1 },
    });
    const a = await lifecycle.birth({ orgId: 'org1' });
    const b = await lifecycle.birth({ orgId: 'org1' });
    revenue.inflow.set(a.treasuryAccountId, 200);
    infra.cost.set(a.id, 20);
    revenue.inflow.set(b.treasuryAccountId, 1);
    infra.cost.set(b.id, 50);
    clock.advanceMs(60_000);
    const decisions = await lifecycle.tick('org1');
    expect(decisions).toHaveLength(2);
    const byId = new Map(decisions.map((d) => [d.automatonId, d]));
    expect(byId.get(a.id)?.nextStatus).toBe('cloning');
    expect(byId.get(b.id)?.nextStatus).toBe('retiring');
  });
});

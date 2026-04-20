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
  byId = new Map<string, AutomatonRecord>();
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
  credit(id: string, amount: number) {
    this.balances.set(id, (this.balances.get(id) ?? 0) + amount);
  }
}

class FakeRevenue implements RevenuePort {
  inflow = new Map<string, number>();
  async netInflowSince(acct: string) { return this.inflow.get(acct) ?? 0; }
  async activePipelineIds() { return ['pl_paid_api']; }
}

class FakeInfra implements InfraPort {
  cost = new Map<string, number>();
  decommissioned: string[] = [];
  async costSince(id: string) { return this.cost.get(id) ?? 0; }
  async decommission(id: string) { this.decommissioned.push(id); }
}

class FakeClone implements ClonePort {
  calls = 0;
  async spawnDescendant() {
    this.calls += 1;
    return { pipelineIds: ['pl_child'], metadata: { spawned: true } };
  }
}

class MockClock implements LifecycleClock {
  private _now: Date;
  private seq = 0;
  constructor(start = new Date('2025-01-01T00:00:00Z')) { this._now = new Date(start); }
  now() { return new Date(this._now); }
  newId() { this.seq += 1; return `aut_e2e_${this.seq}`; }
  advanceMs(ms: number) { this._now = new Date(this._now.getTime() + ms); }
}

describe('automaton-lifecycle e2e — zero-cost product → sale → clone → retire → dead', () => {
  it('simulates a full life of a profitable parent that later starves', async () => {
    const store = new MemStore();
    const treasury = new FakeTreasury();
    const revenue = new FakeRevenue();
    const infra = new FakeInfra();
    const clone = new FakeClone();
    const clock = new MockClock();
    const lifecycle = new AutomatonLifecycle({
      store, treasury, revenue, infra, clone, clock,
      thresholds: {
        probationMs: 10,
        cloneRoi: 2,
        retireRoi: 0.5,
        evaluationMinRevenueUsd: 1,
        retireGraceMs: 30_000,
        maxCloneCount: 3,
      },
    });

    // 1. birth: Sven spawns a zero-cost automaton that wraps an existing skill as a paid API.
    const parent = await lifecycle.birth({ orgId: 'org1', metadata: { kind: 'paid-api-wrapper' } });
    expect(parent.status).toBe('born');
    expect(parent.treasuryAccountId).toMatch(/^acct_/);
    expect(parent.walletId).toMatch(/^wal_/);

    // 2. a customer buys the product on market.sven.systems → marketplace credits treasury.
    treasury.credit(parent.treasuryAccountId, 100);
    revenue.inflow.set(parent.treasuryAccountId, 100);
    infra.cost.set(parent.id, 20);

    // 3. probation elapses, lifecycle evaluates: ROI = 5 → clone.
    clock.advanceMs(60_000);
    const d1 = await lifecycle.evaluate(parent.id);
    expect(d1?.nextStatus).toBe('cloning');
    await lifecycle.applyDecision(d1!);
    expect(clone.calls).toBe(1);
    const all = await store.listAll('org1');
    expect(all).toHaveLength(2);
    const child = all.find((a) => a.parentId === parent.id);
    expect(child?.generation).toBe(1);

    // 4. market shifts, revenue stays flat while cost balloons → retire.
    infra.cost.set(parent.id, 400); // ROI 100/400 = 0.25 < 0.5
    clock.advanceMs(60_000);
    const d2 = await lifecycle.evaluate(parent.id);
    expect(d2?.nextStatus).toBe('retiring');

    // 5. no new inflow across the grace window → dead + decommission.
    clock.advanceMs(60_000);
    const d3 = await lifecycle.evaluate(parent.id);
    expect(d3?.nextStatus).toBe('dead');
    await lifecycle.applyDecision(d3!);
    expect(infra.decommissioned).toContain(parent.id);

    // 6. child is still alive and earning potential preserved.
    const childFresh = await store.get(child!.id);
    expect(childFresh?.status === 'working' || childFresh?.status === 'born').toBe(true);
  });
});

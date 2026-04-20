import { ApprovalTiers } from '../approval/tiers.js';
import type { Pool } from 'pg';

type Row = Record<string, unknown>;

function mockPool(rowSets: Row[][]) {
  let i = 0;
  return {
    query: jest.fn(async () => ({ rows: rowSets[i++] ?? [] })),
  } as unknown as Pool;
}

describe('ApprovalTiers.classify', () => {
  test('auto tier when amount <= auto_max', async () => {
    const pool = mockPool([
      [{
        id: 'tlm_1', org_id: 'o1', scope: 'global', scope_ref: null, currency: 'USD',
        auto_max: '5', notify_max: '50', daily_cap: null, weekly_cap: null, monthly_cap: null,
        effective_from: new Date().toISOString(), effective_to: null, set_by_user_id: null, set_by_agent: false, notes: '',
      }],
      [{ day: 0, week: 0, month: 0 }],
    ]);
    const t = new ApprovalTiers(pool);
    const r = await t.classify({ orgId: 'o1', kind: 'compute_cost', amount: '3' });
    expect(r.tier).toBe('auto');
  });

  test('notify tier when auto_max < amount <= notify_max', async () => {
    const pool = mockPool([
      [{
        id: 'tlm_1', org_id: 'o1', scope: 'global', scope_ref: null, currency: 'USD',
        auto_max: '5', notify_max: '50', daily_cap: null, weekly_cap: null, monthly_cap: null,
        effective_from: new Date().toISOString(), effective_to: null, set_by_user_id: null, set_by_agent: false, notes: '',
      }],
      [{ day: 0, week: 0, month: 0 }],
    ]);
    const t = new ApprovalTiers(pool);
    const r = await t.classify({ orgId: 'o1', kind: 'compute_cost', amount: '20' });
    expect(r.tier).toBe('notify');
  });

  test('approve tier when amount > notify_max', async () => {
    const pool = mockPool([
      [{
        id: 'tlm_1', org_id: 'o1', scope: 'global', scope_ref: null, currency: 'USD',
        auto_max: '5', notify_max: '50', daily_cap: null, weekly_cap: null, monthly_cap: null,
        effective_from: new Date().toISOString(), effective_to: null, set_by_user_id: null, set_by_agent: false, notes: '',
      }],
      [{ day: 0, week: 0, month: 0 }],
    ]);
    const t = new ApprovalTiers(pool);
    const r = await t.classify({ orgId: 'o1', kind: 'compute_cost', amount: '100' });
    expect(r.tier).toBe('approve');
  });

  test('daily cap escalates to approve', async () => {
    const pool = mockPool([
      [{
        id: 'tlm_1', org_id: 'o1', scope: 'global', scope_ref: null, currency: 'USD',
        auto_max: '5', notify_max: '50', daily_cap: '10', weekly_cap: null, monthly_cap: null,
        effective_from: new Date().toISOString(), effective_to: null, set_by_user_id: null, set_by_agent: false, notes: '',
      }],
      [{ day: 9, week: 9, month: 9 }],
    ]);
    const t = new ApprovalTiers(pool);
    const r = await t.classify({ orgId: 'o1', kind: 'compute_cost', amount: '2' });
    expect(r.tier).toBe('approve');
    expect(r.exceeds).toContain('daily_cap');
  });

  test('default fallback (no limit row) applies $5/$50 defaults', async () => {
    const pool = mockPool([
      [],
      [{ day: 0, week: 0, month: 0 }],
    ]);
    const t = new ApprovalTiers(pool);
    const r1 = await t.classify({ orgId: 'o1', kind: 'fee', amount: '4.99' });
    expect(r1.tier).toBe('auto');
  });
});

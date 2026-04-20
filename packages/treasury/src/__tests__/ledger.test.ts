import { Ledger } from '../ledger/ledger.js';
import type { Pool, PoolClient } from 'pg';

function makeClient(rowsByCall: Array<Record<string, unknown>[] | Error>) {
  let i = 0;
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => {
    const next = rowsByCall[i++];
    if (next instanceof Error) throw next;
    return { rows: next ?? [] };
  });
  const release = jest.fn();
  return { client: { query, release } as unknown as PoolClient, query, release };
}

function makePool(client: PoolClient) {
  return {
    connect: jest.fn(async () => client),
    query: jest.fn(async () => ({ rows: [] })),
  } as unknown as Pool;
}

describe('Ledger core invariants', () => {
  test('credit posts a transaction and returns the new balance', async () => {
    // sequence: BEGIN, SELECT account FOR UPDATE, UPDATE account, INSERT tx, COMMIT
    const { client, query } = makeClient([
      [], // BEGIN
      [{ id: 'acc_1', org_id: 'o1', kind: 'operating', label: 'ops', currency: 'USD', balance: '0',
         available: '0', pending_balance: '0', external_ref: null, secret_ref: null,
         frozen: false, metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }], // SELECT FOR UPDATE
      [], // UPDATE
      [{ id: 'ttx_1', org_id: 'o1', account_id: 'acc_1', kind: 'revenue', source: 'test', direction: 'credit',
         amount: '10', currency: 'USD', status: 'posted', counterparty: null, description: null,
         external_ref: null, approval_id: null, pipeline_id: null, related_tx_id: null,
         initiated_by: null, metadata: {}, created_at: new Date().toISOString() }], // INSERT tx
      [], // COMMIT
    ]);
    const pool = makePool(client);
    const ledger = new Ledger(pool);
    const tx = await ledger.credit({
      orgId: 'o1', accountId: 'acc_1', kind: 'revenue', source: 'test', amount: '10', currency: 'USD',
    });
    expect(tx.direction).toBe('credit');
    expect(tx.amount).toBe('10');
    // BEGIN + SELECT + UPDATE + INSERT + COMMIT
    expect(query).toHaveBeenCalledTimes(5);
  });

  test('debit on frozen account throws ACCOUNT_FROZEN and rolls back', async () => {
    const { client, query } = makeClient([
      [], // BEGIN
      [{ id: 'acc_1', org_id: 'o1', kind: 'operating', label: 'ops', currency: 'USD', balance: '100',
         available: '100', pending_balance: '0', external_ref: null, secret_ref: null,
         frozen: true, metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      [], // ROLLBACK
    ]);
    const pool = makePool(client);
    const ledger = new Ledger(pool);
    await expect(
      ledger.debit({ orgId: 'o1', accountId: 'acc_1', kind: 'compute_cost', amount: '10', source: 'test' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_FROZEN' });
    // BEGIN + SELECT + ROLLBACK
    expect(query).toHaveBeenCalledTimes(3);
  });

  test('debit with insufficient funds throws INSUFFICIENT_FUNDS', async () => {
    const { client } = makeClient([
      [], // BEGIN
      [{ id: 'acc_1', org_id: 'o1', kind: 'operating', label: 'ops', currency: 'USD', balance: '5',
         available: '5', pending_balance: '0', external_ref: null, secret_ref: null,
         frozen: false, metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      [], // ROLLBACK
    ]);
    const pool = makePool(client);
    const ledger = new Ledger(pool);
    await expect(
      ledger.debit({ orgId: 'o1', accountId: 'acc_1', kind: 'compute_cost', amount: '10', source: 'test' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });
});

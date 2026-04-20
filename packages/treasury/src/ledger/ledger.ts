// ---------------------------------------------------------------------------
// Treasury Ledger — DB-backed, transactional, double-entry
// ---------------------------------------------------------------------------
// All operations run inside `BEGIN;` ... `COMMIT;`. Balances are mutated ONLY
// inside this module and always together with a row in treasury_transactions.
// ---------------------------------------------------------------------------

import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import type {
  AccountKind,
  Currency,
  Direction,
  RiskTier,
  TreasuryAccount,
  TreasuryTransaction,
  TxKind,
  TxStatus,
} from '../types.js';

const logger = createLogger('treasury.ledger');

function rowToAccount(row: Record<string, unknown>): TreasuryAccount {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    kind: row.kind as AccountKind,
    currency: String(row.currency),
    balance: String(row.balance),
    available: String(row.available),
    reserved: String(row.reserved),
    walletId: row.wallet_id ? String(row.wallet_id) : null,
    frozen: Boolean(row.frozen),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToTx(row: Record<string, unknown>): TreasuryTransaction {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    accountId: String(row.account_id),
    counterAccountId: row.counter_account_id ? String(row.counter_account_id) : null,
    direction: row.direction as Direction,
    amount: String(row.amount),
    currency: String(row.currency),
    kind: row.kind as TxKind,
    source: String(row.source),
    sourceRef: row.source_ref ? String(row.source_ref) : null,
    status: row.status as TxStatus,
    approvalId: row.approval_id ? String(row.approval_id) : null,
    riskTier: row.risk_tier as RiskTier,
    description: String(row.description ?? ''),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    postedAt: row.posted_at ? String(row.posted_at) : null,
  };
}

export interface CreateAccountParams {
  orgId: string;
  name: string;
  kind: AccountKind;
  currency?: Currency;
  walletId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreditParams {
  orgId: string;
  accountId: string;
  amount: string | number;
  currency?: Currency;
  kind: TxKind;
  source: string;
  sourceRef?: string | null;
  riskTier?: RiskTier;
  approvalId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DebitParams extends CreditParams {
  counterAccountId?: string | null;
}

export interface TransferParams {
  orgId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string | number;
  currency?: Currency;
  kind: TxKind;
  source: string;
  sourceRef?: string | null;
  riskTier?: RiskTier;
  approvalId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}

export class LedgerError extends Error {
  constructor(
    public code:
      | 'ACCOUNT_NOT_FOUND'
      | 'ACCOUNT_FROZEN'
      | 'INSUFFICIENT_FUNDS'
      | 'CURRENCY_MISMATCH'
      | 'INVALID_AMOUNT'
      | 'SAME_ACCOUNT_TRANSFER',
    message: string,
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

function normalizeAmount(a: string | number): string {
  const n = typeof a === 'number' ? a : Number(a);
  if (!Number.isFinite(n) || n <= 0) {
    throw new LedgerError('INVALID_AMOUNT', `amount must be finite > 0 (got ${a})`);
  }
  return typeof a === 'number' ? n.toFixed(6) : a;
}

export class Ledger {
  constructor(private pool: pg.Pool) {}

  async createAccount(p: CreateAccountParams): Promise<TreasuryAccount> {
    const id = 'tra_' + uuidv7().replace(/-/g, '').slice(0, 24);
    const currency = p.currency ?? 'USD';
    const res = await this.pool.query(
      `INSERT INTO treasury_accounts (id, org_id, name, kind, currency, wallet_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
      [id, p.orgId, p.name, p.kind, currency, p.walletId ?? null, JSON.stringify(p.metadata ?? {})],
    );
    return rowToAccount(res.rows[0]);
  }

  async getAccount(id: string): Promise<TreasuryAccount | null> {
    const r = await this.pool.query(`SELECT * FROM treasury_accounts WHERE id = $1`, [id]);
    return r.rows[0] ? rowToAccount(r.rows[0]) : null;
  }

  async listAccounts(orgId: string, kind?: AccountKind): Promise<TreasuryAccount[]> {
    const r = kind
      ? await this.pool.query(
          `SELECT * FROM treasury_accounts WHERE org_id=$1 AND kind=$2 ORDER BY created_at`,
          [orgId, kind],
        )
      : await this.pool.query(
          `SELECT * FROM treasury_accounts WHERE org_id=$1 ORDER BY created_at`,
          [orgId],
        );
    return r.rows.map(rowToAccount);
  }

  async findOrCreateOperatingAccount(orgId: string, currency: Currency = 'USD'): Promise<TreasuryAccount> {
    const existing = await this.pool.query(
      `SELECT * FROM treasury_accounts WHERE org_id=$1 AND kind='operating' AND currency=$2 LIMIT 1`,
      [orgId, currency],
    );
    if (existing.rows[0]) return rowToAccount(existing.rows[0]);
    return this.createAccount({ orgId, name: 'Operating', kind: 'operating', currency });
  }

  async setFrozen(accountId: string, frozen: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE treasury_accounts SET frozen=$2, updated_at=NOW() WHERE id=$1`,
      [accountId, frozen],
    );
  }

  /** Credit (money in). Runs in a transaction, locks the account row. */
  async credit(p: CreditParams): Promise<TreasuryTransaction> {
    const amount = normalizeAmount(p.amount);
    const currency = p.currency ?? 'USD';
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const acc = await client.query(
        `SELECT * FROM treasury_accounts WHERE id=$1 AND org_id=$2 FOR UPDATE`,
        [p.accountId, p.orgId],
      );
      if (!acc.rows[0]) throw new LedgerError('ACCOUNT_NOT_FOUND', `account ${p.accountId} not found`);
      const account = rowToAccount(acc.rows[0]);
      if (account.frozen) throw new LedgerError('ACCOUNT_FROZEN', `account ${account.id} frozen`);
      if (account.currency !== currency) {
        throw new LedgerError('CURRENCY_MISMATCH', `account currency ${account.currency} != ${currency}`);
      }

      await client.query(
        `UPDATE treasury_accounts
           SET balance = balance + $2::numeric,
               available = available + $2::numeric,
               updated_at = NOW()
         WHERE id=$1`,
        [p.accountId, amount],
      );

      const txId = 'ttx_' + uuidv7().replace(/-/g, '').slice(0, 24);
      const txRow = await client.query(
        `INSERT INTO treasury_transactions
          (id, org_id, account_id, counter_account_id, direction, amount, currency, kind,
           source, source_ref, status, approval_id, risk_tier, description, metadata, posted_at)
         VALUES ($1,$2,$3,NULL,'credit',$4,$5,$6,$7,$8,'posted',$9,$10,$11,$12::jsonb,NOW())
         RETURNING *`,
        [
          txId,
          p.orgId,
          p.accountId,
          amount,
          currency,
          p.kind,
          p.source,
          p.sourceRef ?? null,
          p.approvalId ?? null,
          p.riskTier ?? 'auto',
          p.description ?? '',
          JSON.stringify(p.metadata ?? {}),
        ],
      );

      await client.query('COMMIT');
      logger.info('credit posted', { accountId: p.accountId, amount, kind: p.kind });
      return rowToTx(txRow.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Debit (money out). Requires sufficient available balance unless counter account is external. */
  async debit(p: DebitParams): Promise<TreasuryTransaction> {
    const amount = normalizeAmount(p.amount);
    const currency = p.currency ?? 'USD';
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const acc = await client.query(
        `SELECT * FROM treasury_accounts WHERE id=$1 AND org_id=$2 FOR UPDATE`,
        [p.accountId, p.orgId],
      );
      if (!acc.rows[0]) throw new LedgerError('ACCOUNT_NOT_FOUND', `account ${p.accountId} not found`);
      const account = rowToAccount(acc.rows[0]);
      if (account.frozen) throw new LedgerError('ACCOUNT_FROZEN', `account ${account.id} frozen`);
      if (account.currency !== currency) {
        throw new LedgerError('CURRENCY_MISMATCH', `account currency ${account.currency} != ${currency}`);
      }
      if (Number(account.available) < Number(amount)) {
        throw new LedgerError('INSUFFICIENT_FUNDS', `available ${account.available} < ${amount}`);
      }

      await client.query(
        `UPDATE treasury_accounts
           SET balance = balance - $2::numeric,
               available = available - $2::numeric,
               updated_at = NOW()
         WHERE id=$1`,
        [p.accountId, amount],
      );

      const txId = 'ttx_' + uuidv7().replace(/-/g, '').slice(0, 24);
      const txRow = await client.query(
        `INSERT INTO treasury_transactions
          (id, org_id, account_id, counter_account_id, direction, amount, currency, kind,
           source, source_ref, status, approval_id, risk_tier, description, metadata, posted_at)
         VALUES ($1,$2,$3,$4,'debit',$5,$6,$7,$8,$9,'posted',$10,$11,$12,$13::jsonb,NOW())
         RETURNING *`,
        [
          txId,
          p.orgId,
          p.accountId,
          p.counterAccountId ?? null,
          amount,
          currency,
          p.kind,
          p.source,
          p.sourceRef ?? null,
          p.approvalId ?? null,
          p.riskTier ?? 'auto',
          p.description ?? '',
          JSON.stringify(p.metadata ?? {}),
        ],
      );

      await client.query('COMMIT');
      logger.info('debit posted', { accountId: p.accountId, amount, kind: p.kind });
      return rowToTx(txRow.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Transfer between two accounts in one atomic unit. */
  async transfer(p: TransferParams): Promise<{ debit: TreasuryTransaction; credit: TreasuryTransaction }> {
    if (p.fromAccountId === p.toAccountId) {
      throw new LedgerError('SAME_ACCOUNT_TRANSFER', 'from and to accounts must differ');
    }
    const amount = normalizeAmount(p.amount);
    const currency = p.currency ?? 'USD';

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock in deterministic order to prevent deadlocks.
      const [first, second] = [p.fromAccountId, p.toAccountId].sort();
      const locked = await client.query(
        `SELECT * FROM treasury_accounts WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
        [[first, second]],
      );
      const rows = new Map(locked.rows.map((r: Record<string, unknown>) => [String(r.id), r]));
      const fromRow = rows.get(p.fromAccountId);
      const toRow = rows.get(p.toAccountId);
      if (!fromRow || !toRow) throw new LedgerError('ACCOUNT_NOT_FOUND', 'one or both accounts missing');
      const from = rowToAccount(fromRow);
      const to = rowToAccount(toRow);
      if (from.orgId !== p.orgId || to.orgId !== p.orgId) {
        throw new LedgerError('ACCOUNT_NOT_FOUND', 'cross-org transfer not permitted');
      }
      if (from.frozen || to.frozen) throw new LedgerError('ACCOUNT_FROZEN', 'one or both accounts frozen');
      if (from.currency !== currency || to.currency !== currency) {
        throw new LedgerError('CURRENCY_MISMATCH', 'currency mismatch on transfer');
      }
      if (Number(from.available) < Number(amount)) {
        throw new LedgerError('INSUFFICIENT_FUNDS', `available ${from.available} < ${amount}`);
      }

      await client.query(
        `UPDATE treasury_accounts SET balance=balance-$2::numeric, available=available-$2::numeric, updated_at=NOW() WHERE id=$1`,
        [p.fromAccountId, amount],
      );
      await client.query(
        `UPDATE treasury_accounts SET balance=balance+$2::numeric, available=available+$2::numeric, updated_at=NOW() WHERE id=$1`,
        [p.toAccountId, amount],
      );

      const debitId = 'ttx_' + uuidv7().replace(/-/g, '').slice(0, 24);
      const creditId = 'ttx_' + uuidv7().replace(/-/g, '').slice(0, 24);

      const debitRow = await client.query(
        `INSERT INTO treasury_transactions
          (id, org_id, account_id, counter_account_id, direction, amount, currency, kind,
           source, source_ref, status, approval_id, risk_tier, description, metadata, posted_at)
         VALUES ($1,$2,$3,$4,'debit',$5,$6,$7,$8,$9,'posted',$10,$11,$12,$13::jsonb,NOW())
         RETURNING *`,
        [
          debitId, p.orgId, p.fromAccountId, p.toAccountId, amount, currency, p.kind,
          p.source, p.sourceRef ?? null, p.approvalId ?? null, p.riskTier ?? 'auto',
          p.description ?? '', JSON.stringify({ ...(p.metadata ?? {}), pair: creditId }),
        ],
      );
      const creditRow = await client.query(
        `INSERT INTO treasury_transactions
          (id, org_id, account_id, counter_account_id, direction, amount, currency, kind,
           source, source_ref, status, approval_id, risk_tier, description, metadata, posted_at)
         VALUES ($1,$2,$3,$4,'credit',$5,$6,$7,$8,$9,'posted',$10,$11,$12,$13::jsonb,NOW())
         RETURNING *`,
        [
          creditId, p.orgId, p.toAccountId, p.fromAccountId, amount, currency, p.kind,
          p.source, p.sourceRef ?? null, p.approvalId ?? null, p.riskTier ?? 'auto',
          p.description ?? '', JSON.stringify({ ...(p.metadata ?? {}), pair: debitId }),
        ],
      );

      await client.query('COMMIT');
      logger.info('transfer posted', { from: p.fromAccountId, to: p.toAccountId, amount });
      return { debit: rowToTx(debitRow.rows[0]), credit: rowToTx(creditRow.rows[0]) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listTransactions(orgId: string, accountId?: string, limit = 100): Promise<TreasuryTransaction[]> {
    const r = accountId
      ? await this.pool.query(
          `SELECT * FROM treasury_transactions WHERE org_id=$1 AND account_id=$2
             ORDER BY created_at DESC LIMIT $3`,
          [orgId, accountId, limit],
        )
      : await this.pool.query(
          `SELECT * FROM treasury_transactions WHERE org_id=$1
             ORDER BY created_at DESC LIMIT $2`,
          [orgId, limit],
        );
    return r.rows.map(rowToTx);
  }
}

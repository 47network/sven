// ---------------------------------------------------------------------------
// Wallet Registry — DB-backed CRUD for crypto_wallets + crypto_transactions.
// ---------------------------------------------------------------------------

import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { createLogger } from '@sven/shared';
import type { Chain, CryptoTransaction, CryptoWallet, Network } from '../types.js';

const logger = createLogger('treasury.wallet');

function rowToWallet(row: Record<string, unknown>): CryptoWallet {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    chain: row.chain as Chain,
    network: row.network as Network,
    address: String(row.address),
    label: String(row.label ?? ''),
    derivationPath: row.derivation_path ? String(row.derivation_path) : null,
    secretRef: String(row.secret_ref),
    status: row.status as CryptoWallet['status'],
    lastKnownBalance: String(row.last_known_balance),
    lastBalanceAt: row.last_balance_at ? String(row.last_balance_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  };
}

function rowToCryptoTx(row: Record<string, unknown>): CryptoTransaction {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    walletId: String(row.wallet_id),
    chain: row.chain as Chain,
    network: row.network as Network,
    direction: row.direction as 'in' | 'out',
    txHash: row.tx_hash ? String(row.tx_hash) : null,
    counterparty: row.counterparty ? String(row.counterparty) : null,
    tokenAddress: row.token_address ? String(row.token_address) : null,
    tokenSymbol: String(row.token_symbol ?? 'ETH'),
    tokenDecimals: Number(row.token_decimals ?? 18),
    amount: String(row.amount),
    feeWei: String(row.fee_wei ?? '0'),
    blockNumber: row.block_number !== null && row.block_number !== undefined ? Number(row.block_number) : null,
    status: row.status as CryptoTransaction['status'],
    treasuryTxId: row.treasury_tx_id ? String(row.treasury_tx_id) : null,
    approvalId: row.approval_id ? String(row.approval_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
  };
}

export interface RegisterWalletParams {
  orgId: string;
  chain: Chain;
  network: Network;
  address: string;
  secretRef: string;
  label?: string;
  derivationPath?: string | null;
  metadata?: Record<string, unknown>;
}

export class WalletRegistry {
  constructor(private pool: pg.Pool) {}

  async register(p: RegisterWalletParams): Promise<CryptoWallet> {
    const id = 'wal_' + uuidv7().replace(/-/g, '').slice(0, 24);
    const r = await this.pool.query(
      `INSERT INTO crypto_wallets
        (id, org_id, chain, network, address, label, derivation_path, secret_ref, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [
        id, p.orgId, p.chain, p.network, p.address.toLowerCase(), p.label ?? '',
        p.derivationPath ?? null, p.secretRef, JSON.stringify(p.metadata ?? {}),
      ],
    );
    logger.info('wallet registered', { id, chain: p.chain, network: p.network });
    return rowToWallet(r.rows[0]);
  }

  async list(orgId: string): Promise<CryptoWallet[]> {
    const r = await this.pool.query(
      `SELECT * FROM crypto_wallets WHERE org_id=$1 AND status<>'revoked' ORDER BY created_at DESC`,
      [orgId],
    );
    return r.rows.map(rowToWallet);
  }

  async get(id: string): Promise<CryptoWallet | null> {
    const r = await this.pool.query(`SELECT * FROM crypto_wallets WHERE id=$1`, [id]);
    return r.rows[0] ? rowToWallet(r.rows[0]) : null;
  }

  async updateBalance(id: string, balance: string): Promise<void> {
    await this.pool.query(
      `UPDATE crypto_wallets SET last_known_balance=$2, last_balance_at=NOW() WHERE id=$1`,
      [id, balance],
    );
  }

  async archive(id: string): Promise<void> {
    await this.pool.query(`UPDATE crypto_wallets SET status='archived' WHERE id=$1`, [id]);
  }

  async recordTx(params: {
    orgId: string;
    walletId: string;
    chain: Chain;
    network: Network;
    direction: 'in' | 'out';
    txHash?: string | null;
    counterparty?: string | null;
    tokenAddress?: string | null;
    tokenSymbol?: string;
    tokenDecimals?: number;
    amount: string;
    feeWei?: string;
    status?: CryptoTransaction['status'];
    treasuryTxId?: string | null;
    approvalId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<CryptoTransaction> {
    const id = 'ctx_' + uuidv7().replace(/-/g, '').slice(0, 24);
    const r = await this.pool.query(
      `INSERT INTO crypto_transactions
        (id, org_id, wallet_id, chain, network, direction, tx_hash, counterparty,
         token_address, token_symbol, token_decimals, amount, fee_wei, status,
         treasury_tx_id, approval_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
       RETURNING *`,
      [
        id, params.orgId, params.walletId, params.chain, params.network, params.direction,
        params.txHash ?? null, params.counterparty ?? null, params.tokenAddress ?? null,
        params.tokenSymbol ?? 'ETH', params.tokenDecimals ?? 18, params.amount,
        params.feeWei ?? '0', params.status ?? 'pending',
        params.treasuryTxId ?? null, params.approvalId ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return rowToCryptoTx(r.rows[0]);
  }

  async markConfirmed(id: string, blockNumber: number): Promise<void> {
    await this.pool.query(
      `UPDATE crypto_transactions SET status='confirmed', block_number=$2, confirmed_at=NOW() WHERE id=$1`,
      [id, blockNumber],
    );
  }

  async listTx(walletId: string, limit = 100): Promise<CryptoTransaction[]> {
    const r = await this.pool.query(
      `SELECT * FROM crypto_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [walletId, limit],
    );
    return r.rows.map(rowToCryptoTx);
  }
}

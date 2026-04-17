// HTTP + DB adapters that back the DI ports defined in automaton-lifecycle.ts
// with real implementations against the deployed services:
//
//   Treasury    → http://127.0.0.1:9477
//   Marketplace → http://127.0.0.1:9478
//   Admin API   → http://127.0.0.1:4000
//   Postgres    → automatons table (see migration
//                 20260420120000_automatons_and_prompt_seed.sql)
//
// These adapters are intentionally narrow: every method maps 1:1 to a real
// HTTP call or a single SQL statement. They are the production wiring for
// the scheduler that gets mounted in services/agent-runtime/src/index.ts
// behind the SVEN_LIFECYCLE_ENABLED feature flag.
import type { Pool } from 'pg';
import { createLogger } from '@sven/shared';
import type {
  AutomatonRecord,
  AutomatonStatus,
  ClonePort,
  InfraPort,
  RevenuePort,
  StorePort,
  TreasuryPort,
} from './automaton-lifecycle.js';
import type { RevenuePipelineRepository } from './revenue-pipeline-repo.js';

const logger = createLogger('automaton-adapters');

async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T | null> {
  const { timeoutMs = 10_000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('automaton adapter http !ok', { url, status: res.status, body: body.slice(0, 500) });
      return null;
    }
    if (res.status === 204) return null;
    return (await res.json()) as T;
  } catch (err) {
    logger.warn('automaton adapter http err', { url, err: (err as Error).message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Treasury ──────────────────────────────────────────────────────
export function makeTreasuryHttp(baseUrl = process.env.TREASURY_URL || 'http://127.0.0.1:9477'): TreasuryPort {
  return {
    async openAccount({ orgId, label }) {
      const data = await fetchJson<{ id: string }>(`${baseUrl}/accounts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, kind: 'operating', name: label, currency: 'USD' }),
      });
      if (!data?.id) {
        throw new Error('treasury openAccount failed');
      }
      return { accountId: data.id };
    },

    async getAccountBalance(accountId) {
      const data = await fetchJson<{ balanceUsd?: number; balance?: number; balance_usd?: number }>(
        `${baseUrl}/accounts/${encodeURIComponent(accountId)}`,
      );
      const bal = data?.balanceUsd ?? data?.balance ?? data?.balance_usd ?? 0;
      return { balanceUsd: Number(bal) || 0 };
    },

    async createWallet({ orgId, label }) {
      const data = await fetchJson<{ id: string }>(`${baseUrl}/wallets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, label }),
      });
      return data?.id ? { walletId: data.id } : null;
    },
  };
}

// ─── Revenue ───────────────────────────────────────────────────────
interface TreasuryTransaction {
  accountId?: string;
  account_id?: string;
  direction?: 'credit' | 'debit';
  amountUsd?: number;
  amount_usd?: number;
  amount?: number;
  createdAt?: string;
  created_at?: string;
}

export function makeRevenueHttp(opts: {
  treasuryUrl?: string;
  marketplaceUrl?: string;
  orgId: string;
  store: StorePort;
} = { orgId: 'default', store: undefined as unknown as StorePort }): RevenuePort {
  const treasuryUrl = opts.treasuryUrl || process.env.TREASURY_URL || 'http://127.0.0.1:9477';
  // marketplaceUrl reserved for future per-listing sales filtering
  const { store } = opts;
  return {
    async netInflowSince(accountId, sinceIso) {
      const url = `${treasuryUrl}/transactions?accountId=${encodeURIComponent(accountId)}&limit=500`;
      const txs = (await fetchJson<TreasuryTransaction[]>(url)) || [];
      const since = Date.parse(sinceIso);
      let net = 0;
      for (const tx of txs) {
        const ts = Date.parse(tx.createdAt || tx.created_at || '');
        if (Number.isFinite(since) && Number.isFinite(ts) && ts < since) continue;
        const amount = Number(tx.amountUsd ?? tx.amount_usd ?? tx.amount ?? 0) || 0;
        if (tx.direction === 'credit') net += amount;
        else if (tx.direction === 'debit') net -= amount;
      }
      return net;
    },

    async activePipelineIds(treasuryAccountId) {
      if (!store) return [];
      try {
        const rows = await (store as StorePort & {
          findByTreasuryAccount?: (id: string) => Promise<AutomatonRecord | null>;
        }).findByTreasuryAccount?.(treasuryAccountId);
        if (!rows) return [];
        return rows.pipelineIds || [];
      } catch {
        return [];
      }
    },
  };
}

/**
 * PG-backed RevenuePort — the production wiring for Batch 6.
 * Uses the RevenuePipelineRepository directly so there is no HTTP hop and so
 * the pipeline ↔ treasury link becomes the single source of truth for both
 * netInflowSince() and activePipelineIds().
 */
export function makeRevenuePg(opts: {
  repo: RevenuePipelineRepository;
  /**
   * Fallback to treasury_transactions if no revenue_events exist for the
   * account yet (e.g. credits posted before the pipeline was created).
   */
  pool?: Pool;
}): RevenuePort {
  const { repo, pool } = opts;
  return {
    async netInflowSince(accountId, sinceIso) {
      const pipelineInflow = await repo.sumNetInflowByTreasurySince(accountId, sinceIso);
      if (pipelineInflow > 0 || !pool) return pipelineInflow;
      // Fallback: tally treasury_transactions directly. Credits increase inflow,
      // debits decrease it, matching the HTTP adapter's semantics.
      const res = await pool.query<{ net: string | null }>(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount
                                  WHEN direction = 'debit'  THEN -amount
                                  ELSE 0 END), 0)::text AS net
           FROM treasury_transactions
          WHERE account_id = $1
            AND created_at >= $2
            AND status = 'posted'`,
        [accountId, sinceIso],
      );
      return Number(res.rows[0]?.net ?? 0) || 0;
    },

    async activePipelineIds(treasuryAccountId) {
      const pipelines = await repo.findActiveByTreasuryAccount(treasuryAccountId);
      return pipelines.map((p) => p.id);
    },
  };
}

// ─── Infra ─────────────────────────────────────────────────────────
export function makeInfraHttp(adminBaseUrl = process.env.ADMIN_API_URL || 'http://127.0.0.1:4000'): InfraPort {
  return {
    async costSince(automatonId, sinceIso) {
      const url = `${adminBaseUrl}/admin/infra/cost?automatonId=${encodeURIComponent(automatonId)}&since=${encodeURIComponent(sinceIso)}`;
      const data = await fetchJson<{ totalUsd?: number; cost_usd?: number }>(url);
      if (!data) return 0;
      return Number(data.totalUsd ?? data.cost_usd ?? 0) || 0;
    },

    async decommission(automatonId) {
      await fetchJson(`${adminBaseUrl}/admin/infra/decommission`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ automatonId, reason: 'lifecycle:dead' }),
      });
    },
  };
}

// ─── Store (Postgres) ──────────────────────────────────────────────
interface AutomatonRow {
  id: string;
  org_id: string;
  parent_id: string | null;
  status: AutomatonStatus;
  treasury_account_id: string;
  wallet_id: string | null;
  generation: number;
  born_at: Date;
  retired_at: Date | null;
  died_at: Date | null;
  pipeline_ids: string[];
  metrics: AutomatonRecord['metrics'];
  metadata: Record<string, unknown>;
}

function rowToRecord(row: AutomatonRow): AutomatonRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    parentId: row.parent_id,
    status: row.status,
    treasuryAccountId: row.treasury_account_id,
    walletId: row.wallet_id,
    generation: row.generation,
    bornAt: row.born_at.toISOString(),
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
    diedAt: row.died_at ? row.died_at.toISOString() : null,
    pipelineIds: Array.isArray(row.pipeline_ids) ? row.pipeline_ids : [],
    metrics: row.metrics,
    metadata: row.metadata || {},
  };
}

export interface PgAutomatonStore extends StorePort {
  findByTreasuryAccount(accountId: string): Promise<AutomatonRecord | null>;
}

export function makeAutomatonStorePg(pool: Pool): PgAutomatonStore {
  return {
    async insert(record) {
      await pool.query(
        `INSERT INTO automatons (id, org_id, parent_id, status, treasury_account_id, wallet_id,
           generation, born_at, retired_at, died_at, pipeline_ids, metrics, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb)`,
        [
          record.id,
          record.orgId,
          record.parentId,
          record.status,
          record.treasuryAccountId,
          record.walletId,
          record.generation,
          record.bornAt,
          record.retiredAt,
          record.diedAt,
          JSON.stringify(record.pipelineIds),
          JSON.stringify(record.metrics),
          JSON.stringify(record.metadata || {}),
        ],
      );
    },

    async update(record) {
      await pool.query(
        `UPDATE automatons SET
            status = $2,
            treasury_account_id = $3,
            wallet_id = $4,
            generation = $5,
            retired_at = $6,
            died_at = $7,
            pipeline_ids = $8::jsonb,
            metrics = $9::jsonb,
            metadata = $10::jsonb,
            updated_at = NOW()
          WHERE id = $1`,
        [
          record.id,
          record.status,
          record.treasuryAccountId,
          record.walletId,
          record.generation,
          record.retiredAt,
          record.diedAt,
          JSON.stringify(record.pipelineIds),
          JSON.stringify(record.metrics),
          JSON.stringify(record.metadata || {}),
        ],
      );
    },

    async get(id) {
      const res = await pool.query<AutomatonRow>(
        `SELECT * FROM automatons WHERE id = $1`,
        [id],
      );
      return res.rows[0] ? rowToRecord(res.rows[0]) : null;
    },

    async listByStatus(orgId, status) {
      const res = await pool.query<AutomatonRow>(
        `SELECT * FROM automatons WHERE org_id = $1 AND status = $2 ORDER BY born_at DESC`,
        [orgId, status],
      );
      return res.rows.map(rowToRecord);
    },

    async listAll(orgId) {
      const res = await pool.query<AutomatonRow>(
        `SELECT * FROM automatons WHERE org_id = $1 ORDER BY born_at DESC`,
        [orgId],
      );
      return res.rows.map(rowToRecord);
    },

    async findByTreasuryAccount(accountId) {
      const res = await pool.query<AutomatonRow>(
        `SELECT * FROM automatons WHERE treasury_account_id = $1 LIMIT 1`,
        [accountId],
      );
      return res.rows[0] ? rowToRecord(res.rows[0]) : null;
    },
  };
}

// ─── Clone (simple) ────────────────────────────────────────────────
// Spawns a descendant by forking the parent's pipeline ids with a _cN suffix.
// Production clones may replace this with something that actually duplicates
// the underlying listings / services on the marketplace.
export function makeCloneSimple(): ClonePort {
  return {
    async spawnDescendant(parent) {
      const cloneIdx = (parent.metrics.cloneCount || 0) + 1;
      const pipelineIds = (parent.pipelineIds || []).map((pid) => `${pid}_c${cloneIdx}`);
      if (pipelineIds.length === 0) return null;
      return {
        pipelineIds,
        metadata: {
          clonedFrom: parent.id,
          cloneIdx,
          cloneReason: 'roi_threshold_met',
        },
      };
    },
  };
}

/**
 * Production clone port: duplicates each of the parent's active pipelines into
 * brand-new pipeline rows bound to the parent's treasury account, so the child
 * inherits earning capacity without cannibalising the parent's history.
 */
export function makeClonePg(opts: { repo: RevenuePipelineRepository }): ClonePort {
  const { repo } = opts;
  return {
    async spawnDescendant(parent) {
      const cloneIdx = (parent.metrics.cloneCount || 0) + 1;
      const parentPipelines = await Promise.all(
        (parent.pipelineIds || []).map((id) => repo.getPipeline(id).catch(() => null)),
      );
      const active = parentPipelines.filter((p): p is NonNullable<typeof p> => !!p && p.status === 'active');
      if (active.length === 0) {
        // No pipelines to inherit — let the scheduler skip the clone.
        return null;
      }
      const pipelineIds: string[] = [];
      for (const parentPipe of active) {
        const child = await repo.createPipeline({
          orgId: parent.orgId,
          name: `${parentPipe.name} (clone #${cloneIdx})`,
          type: parentPipe.type,
          config: {
            ...parentPipe.config,
            typeConfig: {
              ...(parentPipe.config.typeConfig ?? {}),
              clonedFrom: parentPipe.id,
              cloneIdx,
              parentAutomatonId: parent.id,
            },
          },
        });
        const activated = await repo.activatePipeline(child.id);
        pipelineIds.push(activated?.id ?? child.id);
      }
      logger.info('Clone spawned with duplicated pipelines', {
        parent: parent.id,
        cloneIdx,
        pipelineCount: pipelineIds.length,
      });
      return {
        pipelineIds,
        metadata: {
          clonedFrom: parent.id,
          cloneIdx,
          cloneReason: 'roi_threshold_met',
          clonedPipelineParents: active.map((p) => p.id),
        },
      };
    },
  };
}

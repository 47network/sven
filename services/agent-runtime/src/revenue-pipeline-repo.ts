// ---------------------------------------------------------------------------
// Revenue Pipeline Repository — DB-backed (Epic I.3)
// ---------------------------------------------------------------------------
// Replaces in-memory `revenue-pipeline.ts` with a Postgres-backed store that
// posts every recorded revenue event through the Treasury Ledger so the
// double-entry books reflect reality. Accepts an injected pg.Pool + Ledger
// so it plays nicely with gateway-api, sven-treasury and any future
// automaton lifecycle code.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import { createLogger } from '@sven/shared';
import { Ledger } from '@sven/treasury';

const logger = createLogger('revenue-pipeline-repo');

/* ------------------------------------------------------------------ types */

export type PipelineType =
  | 'service_marketplace'
  | 'product_deployment'
  | 'content_creation'
  | 'merchandise'
  | 'custom';

export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived' | 'error';
export type PayoutSchedule = 'instant' | 'daily' | 'weekly' | 'monthly';

export interface PipelineConfig {
  treasuryAccountId: string;
  payoutSchedule: PayoutSchedule;
  minPayoutThreshold: number;
  platformFeePct: number;
  reinvestPct: number;
  typeConfig: Record<string, unknown>;
}

export interface PipelineMetrics {
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  totalPayouts: number;
  pendingPayout: number;
  transactionCount: number;
  avgTransactionSize: number;
  lastDayRevenue: number;
  last7DayRevenue: number;
  last30DayRevenue: number;
}

export interface RevenuePipeline {
  id: string;
  orgId: string;
  name: string;
  type: PipelineType;
  status: PipelineStatus;
  config: PipelineConfig;
  metrics: PipelineMetrics;
  createdAt: string;
  updatedAt: string;
  lastRevenueAt: string | null;
}

export interface RevenueEvent {
  id: string;
  pipelineId: string;
  source: string;
  amount: number;
  fees: number;
  netAmount: number;
  currency: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const DEFAULT_CONFIG: PipelineConfig = {
  treasuryAccountId: '',
  payoutSchedule: 'daily',
  minPayoutThreshold: 10,
  platformFeePct: 2.9,
  reinvestPct: 30,
  typeConfig: {},
};

const EMPTY_METRICS: PipelineMetrics = {
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
};

const MAX_LIMIT = 500;
const MAX_AMOUNT = 1_000_000;

/* ----------------------------------------------------------------- mapping */

type PipelineRow = {
  id: string;
  org_id: string;
  name: string;
  type: PipelineType;
  status: PipelineStatus;
  config: Partial<PipelineConfig> | null;
  metrics: Partial<PipelineMetrics> | null;
  created_at: Date;
  updated_at: Date;
  last_revenue_at: Date | null;
};

function rowToPipeline(row: PipelineRow): RevenuePipeline {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    type: row.type,
    status: row.status,
    config: { ...DEFAULT_CONFIG, ...(row.config ?? {}) },
    metrics: { ...EMPTY_METRICS, ...(row.metrics ?? {}) },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastRevenueAt: row.last_revenue_at ? row.last_revenue_at.toISOString() : null,
  };
}

type EventRow = {
  id: string;
  pipeline_id: string;
  source: string;
  amount: string;
  fees: string;
  net_amount: string;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

function rowToEvent(row: EventRow): RevenueEvent {
  return {
    id: row.id,
    pipelineId: row.pipeline_id,
    source: row.source,
    amount: Number(row.amount),
    fees: Number(row.fees),
    netAmount: Number(row.net_amount),
    currency: row.currency,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

/* ---------------------------------------------------------------- repo API */

export interface RevenuePipelineRepoOptions {
  /** Postgres pool shared with gateway-api */
  pool: Pool;
  /** Treasury ledger to post credits on recordRevenueEvent */
  ledger: Ledger;
}

export class RevenuePipelineRepository {
  private readonly pool: Pool;
  private readonly ledger: Ledger;

  constructor(opts: RevenuePipelineRepoOptions) {
    this.pool = opts.pool;
    this.ledger = opts.ledger;
  }

  async createPipeline(params: {
    orgId: string;
    name: string;
    type: PipelineType;
    config?: Partial<PipelineConfig>;
  }): Promise<RevenuePipeline> {
    const id = `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const config = { ...DEFAULT_CONFIG, ...(params.config ?? {}) };

    const res = await this.pool.query<PipelineRow>(
      `INSERT INTO revenue_pipelines (id, org_id, name, type, status, config, metrics)
       VALUES ($1, $2, $3, $4, 'draft', $5::jsonb, $6::jsonb)
       RETURNING id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at`,
      [id, params.orgId, params.name, params.type, JSON.stringify(config), JSON.stringify(EMPTY_METRICS)],
    );

    logger.info('Revenue pipeline created', { id, orgId: params.orgId, type: params.type });
    return rowToPipeline(res.rows[0]);
  }

  async getPipeline(id: string): Promise<RevenuePipeline | null> {
    const res = await this.pool.query<PipelineRow>(
      `SELECT id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at
         FROM revenue_pipelines WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? rowToPipeline(res.rows[0]) : null;
  }

  async listPipelines(orgId?: string, type?: PipelineType): Promise<RevenuePipeline[]> {
    const conds: string[] = [];
    const values: unknown[] = [];
    if (orgId) {
      values.push(orgId);
      conds.push(`org_id = $${values.length}`);
    }
    if (type) {
      values.push(type);
      conds.push(`type = $${values.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const res = await this.pool.query<PipelineRow>(
      `SELECT id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at
         FROM revenue_pipelines ${where}
         ORDER BY created_at DESC
         LIMIT 500`,
      values,
    );
    return res.rows.map(rowToPipeline);
  }

  async activatePipeline(id: string): Promise<RevenuePipeline | null> {
    const current = await this.getPipeline(id);
    if (!current) return null;
    if (!current.config.treasuryAccountId) {
      throw new Error('Cannot activate pipeline without a treasury account');
    }
    const res = await this.pool.query<PipelineRow>(
      `UPDATE revenue_pipelines SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at`,
      [id],
    );
    logger.info('Revenue pipeline activated', { id });
    return res.rows[0] ? rowToPipeline(res.rows[0]) : null;
  }

  async pausePipeline(id: string): Promise<RevenuePipeline | null> {
    const res = await this.pool.query<PipelineRow>(
      `UPDATE revenue_pipelines SET status = 'paused', updated_at = NOW()
       WHERE id = $1
       RETURNING id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at`,
      [id],
    );
    return res.rows[0] ? rowToPipeline(res.rows[0]) : null;
  }

  async archivePipeline(id: string): Promise<RevenuePipeline | null> {
    const res = await this.pool.query<PipelineRow>(
      `UPDATE revenue_pipelines SET status = 'archived', updated_at = NOW()
       WHERE id = $1
       RETURNING id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at`,
      [id],
    );
    return res.rows[0] ? rowToPipeline(res.rows[0]) : null;
  }

  /**
   * Record a revenue event. Persists to `revenue_events`, updates pipeline
   * metrics, and posts a credit to the pipeline's treasury account via the
   * Ledger. All three writes are wrapped in a single transaction.
   */
  async recordRevenueEvent(params: {
    pipelineId: string;
    source: string;
    amount: number;
    fees?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RevenueEvent> {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new Error('Revenue amount must be positive finite number');
    }
    if (params.amount > MAX_AMOUNT) {
      throw new Error(`Revenue amount exceeds MAX_AMOUNT (${MAX_AMOUNT})`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const pipeRes = await client.query<PipelineRow>(
        `SELECT id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at
           FROM revenue_pipelines WHERE id = $1 FOR UPDATE`,
        [params.pipelineId],
      );
      const pipeRow = pipeRes.rows[0];
      if (!pipeRow) throw new Error(`Pipeline ${params.pipelineId} not found`);
      if (pipeRow.status !== 'active') {
        throw new Error(`Pipeline ${params.pipelineId} is ${pipeRow.status}, not active`);
      }

      const pipe = rowToPipeline(pipeRow);
      const fees = params.fees ?? (params.amount * pipe.config.platformFeePct) / 100;
      const netAmount = Number((params.amount - fees).toFixed(4));
      const currency = params.currency || 'USD';

      const eventId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const metadata = params.metadata || {};

      const evtRes = await client.query<EventRow>(
        `INSERT INTO revenue_events (id, pipeline_id, source, amount, fees, net_amount, currency, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, pipeline_id, source, amount, fees, net_amount, currency, metadata, created_at`,
        [eventId, params.pipelineId, params.source, params.amount, fees, netAmount, currency, JSON.stringify(metadata)],
      );

      const newMetrics: PipelineMetrics = {
        ...pipe.metrics,
        totalRevenue: pipe.metrics.totalRevenue + params.amount,
        totalFees: pipe.metrics.totalFees + fees,
        netRevenue: pipe.metrics.netRevenue + netAmount,
        pendingPayout: pipe.metrics.pendingPayout + netAmount,
        transactionCount: pipe.metrics.transactionCount + 1,
      };
      newMetrics.avgTransactionSize =
        newMetrics.transactionCount > 0 ? newMetrics.totalRevenue / newMetrics.transactionCount : 0;

      await client.query(
        `UPDATE revenue_pipelines
           SET metrics = $1::jsonb, last_revenue_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(newMetrics), params.pipelineId],
      );

      await client.query('COMMIT');

      // Post to Ledger after commit so FK-dependent data exists.
      if (pipe.config.treasuryAccountId) {
        try {
          await this.ledger.credit({
            orgId: pipe.orgId,
            accountId: pipe.config.treasuryAccountId,
            amount: netAmount,
            currency,
            source: params.source || 'revenue_pipeline',
            sourceRef: eventId,
            kind: 'revenue',
            description: `Pipeline ${pipe.name} (${pipe.type})`,
            metadata: { pipelineId: pipe.id, ...metadata },
          });
        } catch (err) {
          logger.error('Ledger credit failed after revenue event committed', {
            eventId,
            pipelineId: pipe.id,
            error: err instanceof Error ? err.message : String(err),
          });
          // Revenue event persists but treasury credit failed — surface an error
          // so caller can compensate or retry. We do NOT rollback the event row.
          throw new Error(`Revenue recorded but treasury credit failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      logger.info('Revenue event recorded', {
        eventId,
        pipelineId: pipe.id,
        amount: params.amount,
        net: netAmount,
      });

      return rowToEvent(evtRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Active pipelines bound to a given treasury account (via config.treasuryAccountId).
   * Used by the automaton lifecycle adapter to answer activePipelineIds().
   */
  async findActiveByTreasuryAccount(treasuryAccountId: string): Promise<RevenuePipeline[]> {
    if (!treasuryAccountId) return [];
    const res = await this.pool.query<PipelineRow>(
      `SELECT id, org_id, name, type, status, config, metrics, created_at, updated_at, last_revenue_at
         FROM revenue_pipelines
         WHERE status = 'active'
           AND config ->> 'treasuryAccountId' = $1
         ORDER BY created_at DESC
         LIMIT 100`,
      [treasuryAccountId],
    );
    return res.rows.map(rowToPipeline);
  }

  /**
   * Sum of net_amount for revenue_events posted to pipelines bound to a given
   * treasury account since `sinceIso`. Used by the lifecycle adapter to answer
   * netInflowSince() without hitting the treasury HTTP service.
   */
  async sumNetInflowByTreasurySince(treasuryAccountId: string, sinceIso: string): Promise<number> {
    if (!treasuryAccountId) return 0;
    const res = await this.pool.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(e.net_amount), 0)::text AS total
         FROM revenue_events e
         JOIN revenue_pipelines p ON p.id = e.pipeline_id
        WHERE p.config ->> 'treasuryAccountId' = $1
          AND e.created_at >= $2`,
      [treasuryAccountId, sinceIso],
    );
    return Number(res.rows[0]?.total ?? 0) || 0;
  }

  /**
   * Create + activate a default service_marketplace pipeline bound to the
   * given treasury account. Used by the seed provisioner when a fresh automaton
   * is born so it has something to earn against immediately.
   *
   * Returns the activated pipeline.
   */
  async seedServiceMarketplacePipeline(params: {
    orgId: string;
    treasuryAccountId: string;
    automatonId: string;
    name?: string;
    config?: Partial<PipelineConfig>;
  }): Promise<RevenuePipeline> {
    const pipeline = await this.createPipeline({
      orgId: params.orgId,
      name: params.name || `Seed pipeline for ${params.automatonId}`,
      type: 'service_marketplace',
      config: {
        treasuryAccountId: params.treasuryAccountId,
        payoutSchedule: 'daily',
        minPayoutThreshold: 1,
        platformFeePct: 2.9,
        reinvestPct: 30,
        typeConfig: { automatonId: params.automatonId, seed: true, ...(params.config?.typeConfig ?? {}) },
        ...(params.config ?? {}),
      },
    });
    const activated = await this.activatePipeline(pipeline.id);
    if (!activated) {
      // Should not happen — createPipeline just inserted the row — but guard anyway.
      throw new Error(`Seed pipeline ${pipeline.id} disappeared before activation`);
    }
    logger.info('Seed service_marketplace pipeline provisioned', {
      pipelineId: activated.id,
      orgId: params.orgId,
      automatonId: params.automatonId,
      treasuryAccountId: params.treasuryAccountId,
    });
    return activated;
  }

  async listRevenueEvents(pipelineId?: string, limit = 100): Promise<RevenueEvent[]> {
    const bounded = Math.min(Math.max(1, limit | 0), MAX_LIMIT);
    if (pipelineId) {
      const res = await this.pool.query<EventRow>(
        `SELECT id, pipeline_id, source, amount, fees, net_amount, currency, metadata, created_at
           FROM revenue_events WHERE pipeline_id = $1
           ORDER BY created_at DESC LIMIT $2`,
        [pipelineId, bounded],
      );
      return res.rows.map(rowToEvent);
    }
    const res = await this.pool.query<EventRow>(
      `SELECT id, pipeline_id, source, amount, fees, net_amount, currency, metadata, created_at
         FROM revenue_events ORDER BY created_at DESC LIMIT $1`,
      [bounded],
    );
    return res.rows.map(rowToEvent);
  }
}

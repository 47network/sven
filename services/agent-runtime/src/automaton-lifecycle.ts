/**
 * Automaton lifecycle — birth -> working -> (clone | retire) -> dead.
 *
 * Implements the Automaton/Conway pattern on Sven's own infra:
 *   1. birth():   allocate a treasury account + wallet, record a new automaton.
 *   2. work():    the agent produces revenue via its revenue pipeline(s).
 *   3. evaluate(): after a probation window, compute ROI from treasury inflow
 *                  vs. cost (compute + infra allocation).
 *   4. clone():   if ROI >= cloneThreshold, spawn a descendant with mutated config.
 *   5. retire():  if ROI < retireThreshold and probation elapsed, mark for retirement.
 *   6. die():     after retireGracePeriod with zero inflow, fully decommission.
 *
 * The module is intentionally port/adapter-shaped so it can run with pluggable
 * treasury / revenue / infra back-ends (real HTTP in prod, in-memory in tests).
 */

import { createLogger } from '@sven/shared';

const logger = createLogger('automaton-lifecycle');

export type AutomatonStatus =
  | 'born'
  | 'working'
  | 'cloning'
  | 'retiring'
  | 'dead';

export interface AutomatonRecord {
  id: string;
  orgId: string;
  parentId: string | null;
  status: AutomatonStatus;
  treasuryAccountId: string;
  walletId: string | null;
  generation: number;
  bornAt: string;
  retiredAt: string | null;
  diedAt: string | null;
  pipelineIds: string[];
  metrics: AutomatonMetrics;
  metadata: Record<string, unknown>;
}

export interface AutomatonMetrics {
  lifetimeRevenueUsd: number;
  lifetimeCostUsd: number;
  lastRoi: number;
  lastEvaluatedAt: string | null;
  cloneCount: number;
  lastInflowAt: string | null;
}

export interface LifecycleThresholds {
  /** ROI (revenue / cost) at which we clone. Default 2.0 (earns 2x its cost). */
  cloneRoi: number;
  /** ROI below which we retire. Default 0.5 (earns <50% of cost). */
  retireRoi: number;
  /** Minimum lifetime revenue before ROI evaluation counts. Default $1 USD. */
  evaluationMinRevenueUsd: number;
  /** ms an automaton must live before first evaluation. Default 24h. */
  probationMs: number;
  /** ms of zero inflow after retiring before death. Default 48h. */
  retireGraceMs: number;
  /** Maximum descendants per automaton. Default 3 to prevent runaway cloning. */
  maxCloneCount: number;
}

export const DEFAULT_THRESHOLDS: LifecycleThresholds = {
  cloneRoi: 2.0,
  retireRoi: 0.5,
  evaluationMinRevenueUsd: 1,
  probationMs: 24 * 60 * 60 * 1000,
  retireGraceMs: 48 * 60 * 60 * 1000,
  maxCloneCount: 3,
};

export interface BirthRequest {
  orgId: string;
  parentId?: string | null;
  generation?: number;
  metadata?: Record<string, unknown>;
}

export interface TreasuryPort {
  openAccount(params: { orgId: string; label: string }): Promise<{ accountId: string }>;
  getAccountBalance(accountId: string): Promise<{ balanceUsd: number }>;
  createWallet?(params: { orgId: string; label: string }): Promise<{ walletId: string } | null>;
}

export interface RevenuePort {
  /** Net inflow into the given treasury account, in USD, since timestamp. */
  netInflowSince(accountId: string, sinceIso: string): Promise<number>;
  /** Active pipeline ids attached to the automaton's treasury account. */
  activePipelineIds(treasuryAccountId: string): Promise<string[]>;
}

export interface InfraPort {
  /** Estimated compute+hosting cost attributed to this automaton since timestamp. */
  costSince(automatonId: string, sinceIso: string): Promise<number>;
  /** Decommission any resources tied exclusively to this automaton. */
  decommission(automatonId: string): Promise<void>;
}

export interface StorePort {
  insert(record: AutomatonRecord): Promise<void>;
  update(record: AutomatonRecord): Promise<void>;
  get(id: string): Promise<AutomatonRecord | null>;
  listByStatus(orgId: string, status: AutomatonStatus): Promise<AutomatonRecord[]>;
  listAll(orgId: string): Promise<AutomatonRecord[]>;
}

export interface ClonePort {
  /**
   * Returns the descendant's pipeline ids / seed config. The caller will wrap
   * it in a fresh AutomatonRecord. Return null to veto the clone.
   */
  spawnDescendant(parent: AutomatonRecord): Promise<{
    pipelineIds: string[];
    metadata: Record<string, unknown>;
  } | null>;
}

export interface LifecycleClock {
  now(): Date;
  /** Random-suffixed id. Kept overridable for deterministic tests. */
  newId(): string;
}

const DEFAULT_CLOCK: LifecycleClock = {
  now: () => new Date(),
  newId: () => `aut_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
};

export interface AutomatonLifecycleOptions {
  treasury: TreasuryPort;
  revenue: RevenuePort;
  infra: InfraPort;
  store: StorePort;
  clone: ClonePort;
  thresholds?: Partial<LifecycleThresholds>;
  clock?: LifecycleClock;
  /**
   * Optional hook invoked inside birth() right after treasury+wallet setup but
   * before the record is persisted. Use it to attach seed pipeline ids / extra
   * metadata to every newborn. Return null/undefined to leave the record as-is.
   */
  onBirth?: (params: {
    automatonId: string;
    orgId: string;
    treasuryAccountId: string;
    walletId: string | null;
  }) => Promise<{ pipelineIds?: string[]; metadata?: Record<string, unknown> } | null | void>;
  /**
   * Optional hook invoked after evaluate() to adjust the decision. Use it to
   * incorporate evolution signals or other external factors into the ROI decision.
   * Return the original decision or a modified copy.
   */
  onDecision?: (automaton: AutomatonRecord, decision: LifecycleDecision) => LifecycleDecision;
}

/** Decision produced by evaluate() — persisted back onto the record. */
export interface LifecycleDecision {
  automatonId: string;
  previousStatus: AutomatonStatus;
  nextStatus: AutomatonStatus;
  roi: number;
  reason: string;
  revenueUsd: number;
  costUsd: number;
}

function clampReason(value: string, max = 280): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export class AutomatonLifecycle {
  private readonly opts: AutomatonLifecycleOptions & {
    thresholds: LifecycleThresholds;
    clock: LifecycleClock;
  };

  constructor(opts: AutomatonLifecycleOptions) {
    this.opts = {
      ...opts,
      thresholds: { ...DEFAULT_THRESHOLDS, ...(opts.thresholds ?? {}) },
      clock: opts.clock ?? DEFAULT_CLOCK,
    };
  }

  async birth(req: BirthRequest): Promise<AutomatonRecord> {
    const now = this.opts.clock.now();
    const id = this.opts.clock.newId();
    const acct = await this.opts.treasury.openAccount({
      orgId: req.orgId,
      label: `automaton:${id}`,
    });
    let walletId: string | null = null;
    if (this.opts.treasury.createWallet) {
      try {
        const w = await this.opts.treasury.createWallet({
          orgId: req.orgId,
          label: `automaton:${id}`,
        });
        walletId = w?.walletId ?? null;
      } catch (err) {
        logger.warn('birth: wallet creation skipped', {
          id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const record: AutomatonRecord = {
      id,
      orgId: req.orgId,
      parentId: req.parentId ?? null,
      status: 'born',
      treasuryAccountId: acct.accountId,
      walletId,
      generation: req.generation ?? (req.parentId ? 1 : 0),
      bornAt: now.toISOString(),
      retiredAt: null,
      diedAt: null,
      pipelineIds: [],
      metrics: {
        lifetimeRevenueUsd: 0,
        lifetimeCostUsd: 0,
        lastRoi: 0,
        lastEvaluatedAt: null,
        cloneCount: 0,
        lastInflowAt: null,
      },
      metadata: req.metadata ?? {},
    };

    if (this.opts.onBirth) {
      try {
        const seeded = await this.opts.onBirth({
          automatonId: record.id,
          orgId: record.orgId,
          treasuryAccountId: record.treasuryAccountId,
          walletId: record.walletId,
        });
        if (seeded?.pipelineIds && seeded.pipelineIds.length > 0) {
          record.pipelineIds = [...record.pipelineIds, ...seeded.pipelineIds];
        }
        if (seeded?.metadata) {
          record.metadata = { ...record.metadata, ...seeded.metadata };
        }
      } catch (err) {
        logger.warn('birth: onBirth hook failed — continuing with empty seed', {
          id: record.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.opts.store.insert(record);
    logger.info('automaton born', {
      id,
      orgId: record.orgId,
      parentId: record.parentId,
      pipelineCount: record.pipelineIds.length,
    });
    return record;
  }

  /** Mark an automaton as actively producing revenue. Idempotent. */
  async markWorking(id: string): Promise<AutomatonRecord | null> {
    const rec = await this.opts.store.get(id);
    if (!rec) return null;
    if (rec.status !== 'born' && rec.status !== 'working') return rec;
    if (rec.status === 'working') return rec;
    rec.status = 'working';
    rec.pipelineIds = await this.opts.revenue.activePipelineIds(rec.treasuryAccountId);
    await this.opts.store.update(rec);
    return rec;
  }

  /**
   * Run one evaluation step for a single automaton. Pure state transition;
   * doesn't itself invoke clone/retire side-effects — callers orchestrate that.
   */
  async evaluate(id: string): Promise<LifecycleDecision | null> {
    const rec = await this.opts.store.get(id);
    if (!rec) return null;
    if (rec.status === 'dead') return null;

    const now = this.opts.clock.now();
    const ageMs = now.getTime() - new Date(rec.bornAt).getTime();
    const revenueUsd = await this.opts.revenue.netInflowSince(
      rec.treasuryAccountId,
      rec.bornAt,
    );
    const costUsd = await this.opts.infra.costSince(rec.id, rec.bornAt);
    const roi = costUsd > 0 ? revenueUsd / costUsd : revenueUsd > 0 ? Infinity : 0;

    const th = this.opts.thresholds;
    let nextStatus: AutomatonStatus = rec.status === 'born' ? 'working' : rec.status;
    let reason = 'no change';

    if (rec.status === 'retiring') {
      const retiredAt = rec.retiredAt ? new Date(rec.retiredAt).getTime() : now.getTime();
      const graceElapsed = now.getTime() - retiredAt >= th.retireGraceMs;
      const lastInflowRecent =
        rec.metrics.lastInflowAt &&
        now.getTime() - new Date(rec.metrics.lastInflowAt).getTime() < th.retireGraceMs;
      if (graceElapsed && !lastInflowRecent) {
        nextStatus = 'dead';
        reason = clampReason(`retire grace elapsed with no inflow`);
      }
    } else if (ageMs < th.probationMs) {
      reason = clampReason(`probation: ${Math.floor(ageMs / 1000)}s / ${Math.floor(th.probationMs / 1000)}s`);
    } else if (revenueUsd < th.evaluationMinRevenueUsd) {
      nextStatus = 'retiring';
      reason = clampReason(`insufficient lifetime revenue ($${revenueUsd.toFixed(2)})`);
    } else if (roi >= th.cloneRoi && rec.metrics.cloneCount < th.maxCloneCount) {
      nextStatus = 'cloning';
      reason = clampReason(`ROI ${roi.toFixed(2)} >= clone threshold ${th.cloneRoi}`);
    } else if (roi < th.retireRoi) {
      nextStatus = 'retiring';
      reason = clampReason(`ROI ${roi.toFixed(2)} < retire threshold ${th.retireRoi}`);
    } else {
      nextStatus = 'working';
      reason = clampReason(`ROI ${roi.toFixed(2)} within band`);
    }

    const prev = rec.status;
    rec.status = nextStatus;
    rec.metrics.lifetimeRevenueUsd = revenueUsd;
    rec.metrics.lifetimeCostUsd = costUsd;
    rec.metrics.lastRoi = Number.isFinite(roi) ? roi : rec.metrics.lastRoi;
    rec.metrics.lastEvaluatedAt = now.toISOString();
    if (revenueUsd > 0 && revenueUsd !== (rec.metrics.lifetimeRevenueUsd ?? 0)) {
      rec.metrics.lastInflowAt = now.toISOString();
    }
    if (nextStatus === 'retiring' && !rec.retiredAt) rec.retiredAt = now.toISOString();
    if (nextStatus === 'dead' && !rec.diedAt) rec.diedAt = now.toISOString();
    await this.opts.store.update(rec);

    const decision: LifecycleDecision = {
      automatonId: rec.id,
      previousStatus: prev,
      nextStatus,
      roi,
      reason,
      revenueUsd,
      costUsd,
    };
    logger.info('automaton evaluated', { ...decision });
    return decision;
  }

  /** Apply a decision: clone or decommission as needed. Safe to call after evaluate. */
  async applyDecision(decision: LifecycleDecision): Promise<AutomatonRecord | null> {
    const rec = await this.opts.store.get(decision.automatonId);
    if (!rec) return null;
    if (decision.nextStatus === 'cloning') {
      if (rec.metrics.cloneCount >= this.opts.thresholds.maxCloneCount) {
        rec.status = 'working';
        await this.opts.store.update(rec);
        return rec;
      }
      const spawn = await this.opts.clone.spawnDescendant(rec);
      if (!spawn) {
        rec.status = 'working';
        await this.opts.store.update(rec);
        return rec;
      }
      const child = await this.birth({
        orgId: rec.orgId,
        parentId: rec.id,
        generation: rec.generation + 1,
        metadata: spawn.metadata,
      });
      child.pipelineIds = spawn.pipelineIds;
      child.status = 'working';
      await this.opts.store.update(child);
      rec.metrics.cloneCount += 1;
      rec.status = 'working';
      await this.opts.store.update(rec);
      return rec;
    }
    if (decision.nextStatus === 'dead') {
      await this.opts.infra.decommission(rec.id);
      await this.opts.store.update(rec);
      return rec;
    }
    return rec;
  }

  /** Evaluate every non-dead automaton for an org. Returns decisions made. */
  async tick(orgId: string): Promise<LifecycleDecision[]> {
    const all = await this.opts.store.listAll(orgId);
    const decisions: LifecycleDecision[] = [];
    for (const rec of all) {
      if (rec.status === 'dead') continue;
      // Freshly born automatons need to be promoted to 'working' before their
      // first evaluation — this pulls live pipelineIds through the RevenuePort.
      if (rec.status === 'born') {
        try {
          await this.markWorking(rec.id);
        } catch (err) {
          logger.warn('tick: markWorking failed for born automaton', {
            id: rec.id,
            err: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
      }
      const d = await this.evaluate(rec.id);
      if (!d) continue;
      // Apply optional decision adjustment hook (e.g. evolution bridge)
      const adjusted = this.opts.onDecision
        ? this.opts.onDecision(rec, d)
        : d;
      decisions.push(adjusted);
      if (adjusted.nextStatus === 'cloning' || adjusted.nextStatus === 'dead') {
        await this.applyDecision(adjusted);
      }
    }
    return decisions;
  }
}

export interface LifecycleSchedulerOptions {
  lifecycle: AutomatonLifecycle;
  orgId: string;
  /** Default 10 minutes. */
  intervalMs?: number;
  onError?: (err: unknown) => void;
}

export function startLifecycleScheduler(opts: LifecycleSchedulerOptions): () => void {
  const intervalMs = opts.intervalMs ?? 10 * 60 * 1000;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await opts.lifecycle.tick(opts.orgId);
    } catch (err) {
      if (opts.onError) opts.onError(err);
      else logger.error('lifecycle tick failed', { err: err instanceof Error ? err.message : String(err) });
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

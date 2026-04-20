// ---------------------------------------------------------------------------
// Approval Tiers — classify a proposed spend into auto/notify/approve.
// ---------------------------------------------------------------------------
// Sven sets sensible defaults and can tune them; user (owner/admin) can
// override. Daily/weekly/monthly caps escalate the tier when reached.
// ---------------------------------------------------------------------------

import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import type { Currency, RiskTier, TreasuryLimit, TxKind } from '../types.js';

export interface ClassifyInput {
  orgId: string;
  accountId?: string;
  kind: TxKind;
  amount: string | number;
  currency?: Currency;
}

export interface ClassifyResult {
  tier: RiskTier;
  reason: string;
  appliedLimit: TreasuryLimit | null;
  exceeds: Array<'auto_max' | 'notify_max' | 'daily_cap' | 'weekly_cap' | 'monthly_cap'>;
}

const DEFAULT_LIMIT: Omit<TreasuryLimit, 'id'> = {
  orgId: '',
  scope: 'global',
  scopeRef: null,
  currency: 'USD',
  autoMax: '5',
  notifyMax: '50',
  dailyCap: null,
  weeklyCap: null,
  monthlyCap: null,
  effectiveFrom: new Date(0).toISOString(),
  effectiveTo: null,
  setByUserId: null,
  setByAgent: false,
  notes: 'default',
};

function rowToLimit(row: Record<string, unknown>): TreasuryLimit {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    scope: row.scope as TreasuryLimit['scope'],
    scopeRef: row.scope_ref ? String(row.scope_ref) : null,
    currency: String(row.currency),
    autoMax: String(row.auto_max),
    notifyMax: String(row.notify_max),
    dailyCap: row.daily_cap !== null && row.daily_cap !== undefined ? String(row.daily_cap) : null,
    weeklyCap: row.weekly_cap !== null && row.weekly_cap !== undefined ? String(row.weekly_cap) : null,
    monthlyCap: row.monthly_cap !== null && row.monthly_cap !== undefined ? String(row.monthly_cap) : null,
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to ? String(row.effective_to) : null,
    setByUserId: row.set_by_user_id ? String(row.set_by_user_id) : null,
    setByAgent: Boolean(row.set_by_agent),
    notes: String(row.notes ?? ''),
  };
}

export class ApprovalTiers {
  constructor(private pool: pg.Pool) {}

  /** Resolve the most specific active limit. Priority: kind > account > global. */
  async resolveLimit(orgId: string, accountId: string | undefined, kind: TxKind, currency: Currency): Promise<TreasuryLimit | null> {
    const res = await this.pool.query(
      `SELECT * FROM treasury_limits
        WHERE org_id=$1 AND currency=$2
          AND effective_from <= NOW()
          AND (effective_to IS NULL OR effective_to > NOW())
          AND (
               (scope='kind'    AND scope_ref=$3) OR
               (scope='account' AND scope_ref=$4) OR
                scope='global'
          )
        ORDER BY CASE scope WHEN 'kind' THEN 0 WHEN 'account' THEN 1 ELSE 2 END, effective_from DESC
        LIMIT 1`,
      [orgId, currency, kind, accountId ?? null],
    );
    return res.rows[0] ? rowToLimit(res.rows[0]) : null;
  }

  async classify(input: ClassifyInput): Promise<ClassifyResult> {
    const currency = input.currency ?? 'USD';
    const limit = await this.resolveLimit(input.orgId, input.accountId, input.kind, currency);
    const effective = limit ?? { ...DEFAULT_LIMIT, id: 'default', orgId: input.orgId, currency };
    const amount = Number(input.amount);
    const exceeds: ClassifyResult['exceeds'] = [];

    const windowSums = await this.windowSums(input.orgId, input.accountId, currency, input.kind);

    if (effective.dailyCap && windowSums.day + amount > Number(effective.dailyCap)) exceeds.push('daily_cap');
    if (effective.weeklyCap && windowSums.week + amount > Number(effective.weeklyCap)) exceeds.push('weekly_cap');
    if (effective.monthlyCap && windowSums.month + amount > Number(effective.monthlyCap)) exceeds.push('monthly_cap');

    let tier: RiskTier = 'auto';
    let reason = `amount ${amount} within auto_max ${effective.autoMax}`;

    if (amount > Number(effective.notifyMax) || exceeds.length) {
      tier = 'approve';
      reason = exceeds.length
        ? `window cap exceeded: ${exceeds.join(',')}`
        : `amount ${amount} > notify_max ${effective.notifyMax}`;
    } else if (amount > Number(effective.autoMax)) {
      tier = 'notify';
      reason = `amount ${amount} > auto_max ${effective.autoMax} (<= notify_max ${effective.notifyMax})`;
    }

    return { tier, reason, appliedLimit: limit, exceeds };
  }

  /** Sum posted debits by kind in day/week/month windows for the given account/org. */
  private async windowSums(orgId: string, accountId: string | undefined, currency: Currency, kind: TxKind) {
    const sql = `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day'   THEN amount ELSE 0 END),0) AS day,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days'  THEN amount ELSE 0 END),0) AS week,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END),0) AS month
      FROM treasury_transactions
      WHERE org_id=$1 AND currency=$2 AND direction='debit' AND status='posted' AND kind=$3
        ${accountId ? 'AND account_id=$4' : ''}`;
    const params: unknown[] = [orgId, currency, kind];
    if (accountId) params.push(accountId);
    const r = await this.pool.query(sql, params);
    return {
      day: Number(r.rows[0]?.day || 0),
      week: Number(r.rows[0]?.week || 0),
      month: Number(r.rows[0]?.month || 0),
    };
  }

  async upsertLimit(input: Omit<TreasuryLimit, 'id' | 'effectiveFrom' | 'effectiveTo'> & { effectiveFrom?: string; effectiveTo?: string | null }): Promise<TreasuryLimit> {
    const id = 'tlm_' + uuidv7().replace(/-/g, '').slice(0, 24);
    const r = await this.pool.query(
      `INSERT INTO treasury_limits
        (id, org_id, scope, scope_ref, currency, auto_max, notify_max, daily_cap, weekly_cap, monthly_cap,
         effective_from, effective_to, set_by_user_id, set_by_agent, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,NOW()),$12,$13,$14,$15)
       RETURNING *`,
      [
        id, input.orgId, input.scope, input.scopeRef ?? null, input.currency,
        input.autoMax, input.notifyMax,
        input.dailyCap ?? null, input.weeklyCap ?? null, input.monthlyCap ?? null,
        input.effectiveFrom ?? null, input.effectiveTo ?? null,
        input.setByUserId ?? null, input.setByAgent, input.notes ?? '',
      ],
    );
    return rowToLimit(r.rows[0]);
  }

  async listLimits(orgId: string): Promise<TreasuryLimit[]> {
    const r = await this.pool.query(
      `SELECT * FROM treasury_limits WHERE org_id=$1 ORDER BY created_at DESC`,
      [orgId],
    );
    return r.rows.map(rowToLimit);
  }
}

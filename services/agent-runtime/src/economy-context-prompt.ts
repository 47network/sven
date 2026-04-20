/**
 * Economy Context Prompt — injects real-time treasury / automaton / revenue /
 * marketplace awareness into Sven's system prompt so it can reason about its
 * own economic state and available economy commands.
 */

import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('economy-context-prompt');

export interface EconomySnapshot {
  treasuryAccounts: number;
  totalBalanceUsd: number;
  activeAutomatons: number;
  workingAutomatons: number;
  cloningAutomatons: number;
  retiringAutomatons: number;
  activePipelines: number;
  revenue24hUsd: number;
  marketplaceListings: number;
  seedPipelines: number;
  refunds24hCount: number;
  refunds24hUsd: number;
}

/**
 * Query the DB for live economy metrics.
 * Every query is wrapped in its own try/catch so a missing table never
 * takes down the whole prompt builder — we just omit that section.
 */
export async function gatherEconomySnapshot(pool: pg.Pool): Promise<EconomySnapshot> {
  const snap: EconomySnapshot = {
    treasuryAccounts: 0,
    totalBalanceUsd: 0,
    activeAutomatons: 0,
    workingAutomatons: 0,
    cloningAutomatons: 0,
    retiringAutomatons: 0,
    activePipelines: 0,
    revenue24hUsd: 0,
    marketplaceListings: 0,
    seedPipelines: 0,
    refunds24hCount: 0,
    refunds24hUsd: 0,
  };

  // Treasury accounts + total balance
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS count,
              COALESCE(SUM(balance_usd), 0)::numeric AS total_balance
       FROM treasury_accounts
       WHERE status = 'active'`,
    );
    snap.treasuryAccounts = res.rows[0]?.count || 0;
    snap.totalBalanceUsd = parseFloat(res.rows[0]?.total_balance || '0');
  } catch { /* treasury_accounts may not exist */ }

  // Automatons by status
  try {
    const res = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM automatons
       WHERE status != 'dead'
       GROUP BY status`,
    );
    for (const row of res.rows) {
      const r = row as { status: string; count: number };
      if (r.status === 'working') snap.workingAutomatons = r.count;
      else if (r.status === 'cloning') snap.cloningAutomatons = r.count;
      else if (r.status === 'retiring') snap.retiringAutomatons = r.count;
      snap.activeAutomatons += r.count;
    }
  } catch { /* automatons table may not exist */ }

  // Active revenue pipelines + seed pipelines
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE config->>'seed' = 'true')::int AS seeds
       FROM revenue_pipelines
       WHERE status = 'active'`,
    );
    snap.activePipelines = res.rows[0]?.total || 0;
    snap.seedPipelines = res.rows[0]?.seeds || 0;
  } catch { /* revenue_pipelines may not exist */ }

  // 24h revenue (net inflow from revenue events)
  try {
    const res = await pool.query(
      `SELECT COALESCE(SUM(net_amount), 0)::numeric AS net_24h
       FROM revenue_events
       WHERE created_at >= NOW() - INTERVAL '24 hours'`,
    );
    snap.revenue24hUsd = parseFloat(res.rows[0]?.net_24h || '0');
  } catch { /* revenue_events may not exist */ }

  // Marketplace listings
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM marketplace_listings
       WHERE status = 'active'`,
    );
    snap.marketplaceListings = res.rows[0]?.count || 0;
  } catch { /* marketplace_listings may not exist */ }

  // Refunds in last 24h
  try {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS count,
              COALESCE(SUM(total), 0)::numeric AS total_refunded
       FROM marketplace_orders
       WHERE status = 'refunded'
         AND updated_at >= NOW() - INTERVAL '24 hours'`,
    );
    snap.refunds24hCount = res.rows[0]?.count || 0;
    snap.refunds24hUsd = parseFloat(res.rows[0]?.total_refunded || '0');
  } catch { /* marketplace_orders may not exist */ }

  return snap;
}

/**
 * Build the economy context block for injection into the system prompt.
 * Returns empty string if the economy is completely empty (no accounts,
 * no automatons, no pipelines).
 */
export async function buildEconomyContextPrompt(pool: pg.Pool): Promise<string> {
  try {
    const snap = await gatherEconomySnapshot(pool);

    // Skip if the economy is completely empty — no point injecting zero context
    const hasAnyEconomy =
      snap.treasuryAccounts > 0 ||
      snap.activeAutomatons > 0 ||
      snap.activePipelines > 0 ||
      snap.marketplaceListings > 0;
    if (!hasAnyEconomy) return '';

    const sections: string[] = [];

    // Treasury
    if (snap.treasuryAccounts > 0) {
      sections.push(
        `Treasury: ${snap.treasuryAccounts} account(s), $${snap.totalBalanceUsd.toFixed(2)} total balance`,
      );
    }

    // Automatons
    if (snap.activeAutomatons > 0) {
      const parts = [`${snap.activeAutomatons} active`];
      if (snap.workingAutomatons > 0) parts.push(`${snap.workingAutomatons} working`);
      if (snap.cloningAutomatons > 0) parts.push(`${snap.cloningAutomatons} cloning`);
      if (snap.retiringAutomatons > 0) parts.push(`${snap.retiringAutomatons} retiring`);
      sections.push(`Automatons: ${parts.join(', ')}`);
    }

    // Revenue pipelines
    if (snap.activePipelines > 0) {
      const seedNote = snap.seedPipelines > 0 ? ` (${snap.seedPipelines} seed)` : '';
      sections.push(`Revenue pipelines: ${snap.activePipelines} active${seedNote}`);
    }

    // 24h revenue
    if (snap.revenue24hUsd !== 0) {
      const sign = snap.revenue24hUsd >= 0 ? '+' : '';
      sections.push(`24h revenue: ${sign}$${snap.revenue24hUsd.toFixed(2)}`);
    }

    // Marketplace
    if (snap.marketplaceListings > 0) {
      sections.push(`Marketplace: ${snap.marketplaceListings} active listing(s) on market.sven.systems`);
    }

    // Refunds
    if (snap.refunds24hCount > 0) {
      sections.push(`Refunds: ${snap.refunds24hCount} in 24h ($${snap.refunds24hUsd.toFixed(2)} total)`);
    }

    if (sections.length === 0) return '';

    return [
      'Your Autonomous Economy:',
      ...sections.map((s) => `• ${s}`),
      '',
      'Economy commands: /economy status, /treasury balance, /market listings, /eidolon snapshot',
      'Spend approval tiers: auto ≤$5, notify $5–$50, approve >$50',
    ].join('\n');
  } catch (err) {
    logger.warn('buildEconomyContextPrompt failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return '';
  }
}

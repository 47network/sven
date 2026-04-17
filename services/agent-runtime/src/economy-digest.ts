/**
 * Economy Digest — builds daily economy summaries for proactive-notifier
 * delivery via NATS / Slack / admin dashboard.
 *
 * The digest is scheduled by the lifecycle scheduler or a standalone interval.
 * It gathers treasury, automaton, pipeline, and marketplace stats, formats a
 * human-readable report, and publishes to `sven.economy.digest`.
 */

import pg from 'pg';
import { createLogger } from '@sven/shared';
import type { NatsConnection } from 'nats';
import { StringCodec } from 'nats';
import { gatherEconomySnapshot, type EconomySnapshot } from './economy-context-prompt.js';

const logger = createLogger('economy-digest');
const sc = StringCodec();

/* ------------------------------------------------------------------ types */

export interface DigestConfig {
  /** NATS subject for digest messages. Default `sven.economy.digest`. */
  natsSubject: string;
  /** Interval in ms between digests. Default 24h. */
  intervalMs: number;
  /** Organization id for scoped queries. */
  orgId: string;
}

export interface DigestReport {
  orgId: string;
  generatedAt: string;
  snapshot: EconomySnapshot;
  formattedText: string;
  highlights: string[];
}

const DEFAULT_CONFIG: DigestConfig = {
  natsSubject: 'sven.economy.digest',
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  orgId: 'default',
};

/* ----------------------------------------------------------- formatting */

function currencyFmt(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/**
 * Generate highlight bullet points from the snapshot.
 */
function generateHighlights(snap: EconomySnapshot): string[] {
  const highlights: string[] = [];

  if (snap.totalBalanceUsd > 100) {
    highlights.push(`💰 Treasury balance exceeds $100 — consider investing in new pipelines`);
  }
  if (snap.totalBalanceUsd < 1 && snap.treasuryAccounts > 0) {
    highlights.push(`⚠️ Treasury balance near zero — revenue pipelines need attention`);
  }
  if (snap.retiringAutomatons > 0) {
    highlights.push(`🔻 ${snap.retiringAutomatons} automaton(s) retiring — review their pipelines`);
  }
  if (snap.cloningAutomatons > 0) {
    highlights.push(`🔀 ${snap.cloningAutomatons} automaton(s) cloning — expansion in progress`);
  }
  if (snap.revenue24hUsd > 0) {
    highlights.push(`📈 Positive revenue in last 24h: ${currencyFmt(snap.revenue24hUsd)}`);
  }
  if (snap.revenue24hUsd < 0) {
    highlights.push(`📉 Negative revenue in last 24h: ${currencyFmt(snap.revenue24hUsd)}`);
  }
  if (snap.seedPipelines > 0 && snap.seedPipelines === snap.activePipelines) {
    highlights.push(`🌱 All pipelines are seed-stage — diversification recommended`);
  }
  if (snap.marketplaceListings === 0 && snap.activePipelines > 0) {
    highlights.push(`🏪 No marketplace listings — consider publishing services to market.sven.systems`);
  }
  if (snap.refunds24hCount > 0) {
    highlights.push(`🔄 ${snap.refunds24hCount} refund(s) in 24h totalling $${snap.refunds24hUsd.toFixed(2)} — review product quality`);
  }
  if (snap.refunds24hUsd > 0 && snap.revenue24hUsd > 0 && snap.refunds24hUsd / snap.revenue24hUsd > 0.2) {
    highlights.push(`⚠️ Refund rate exceeds 20% of revenue — investigate buyer complaints`);
  }

  return highlights;
}

/**
 * Format the snapshot into a human-readable digest text.
 */
export function formatDigest(snap: EconomySnapshot, orgId: string): DigestReport {
  const now = new Date().toISOString();
  const highlights = generateHighlights(snap);

  const lines: string[] = [
    `═══════════════════════════════════════`,
    `  SVEN ECONOMY DIGEST`,
    `  ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    `═══════════════════════════════════════`,
    ``,
    `TREASURY`,
    `  Accounts: ${snap.treasuryAccounts}`,
    `  Balance:  $${snap.totalBalanceUsd.toFixed(2)}`,
    ``,
    `AUTOMATONS`,
    `  Active:   ${snap.activeAutomatons} total`,
    `  Working:  ${snap.workingAutomatons}`,
    `  Cloning:  ${snap.cloningAutomatons}`,
    `  Retiring: ${snap.retiringAutomatons}`,
    ``,
    `REVENUE`,
    `  Active pipelines: ${snap.activePipelines} (${snap.seedPipelines} seed)`,
    `  24h net:          ${currencyFmt(snap.revenue24hUsd)}`,
    ``,
    `MARKETPLACE`,
    `  Active listings: ${snap.marketplaceListings}`,
    `  24h refunds:     ${snap.refunds24hCount} ($${snap.refunds24hUsd.toFixed(2)})`,
  ];

  if (highlights.length > 0) {
    lines.push(``, `HIGHLIGHTS`);
    for (const h of highlights) {
      lines.push(`  ${h}`);
    }
  }

  lines.push(``, `═══════════════════════════════════════`);

  return {
    orgId,
    generatedAt: now,
    snapshot: snap,
    formattedText: lines.join('\n'),
    highlights,
  };
}

/* --------------------------------------------------------- build & send */

/**
 * Build a full digest from the database.
 */
export async function buildDigest(
  pool: pg.Pool,
  orgId: string,
): Promise<DigestReport> {
  const snap = await gatherEconomySnapshot(pool);
  return formatDigest(snap, orgId);
}

/**
 * Build a digest and publish it to NATS.
 */
export async function publishDigest(
  pool: pg.Pool,
  nc: NatsConnection,
  config: Partial<DigestConfig> = {},
): Promise<DigestReport> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const report = await buildDigest(pool, cfg.orgId);

  try {
    nc.publish(cfg.natsSubject, sc.encode(JSON.stringify(report)));
    logger.info('economy digest published', {
      orgId: cfg.orgId,
      subject: cfg.natsSubject,
      highlights: report.highlights.length,
    });
  } catch (err) {
    logger.warn('economy digest NATS publish failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return report;
}

/* ----------------------------------------------------------- scheduler */

let digestTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start a recurring economy digest publisher.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startDigestScheduler(
  pool: pg.Pool,
  nc: NatsConnection,
  config: Partial<DigestConfig> = {},
): void {
  if (digestTimer) return;
  const cfg = { ...DEFAULT_CONFIG, ...config };
  logger.info('economy digest scheduler started', {
    intervalMs: cfg.intervalMs,
    subject: cfg.natsSubject,
  });

  // Fire once immediately on startup
  publishDigest(pool, nc, cfg).catch((err) => {
    logger.warn('initial digest failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  digestTimer = setInterval(() => {
    publishDigest(pool, nc, cfg).catch((err) => {
      logger.warn('scheduled digest failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, cfg.intervalMs);
}

/**
 * Stop the digest scheduler. Idempotent.
 */
export function stopDigestScheduler(): void {
  if (!digestTimer) return;
  clearInterval(digestTimer);
  digestTimer = null;
  logger.info('economy digest scheduler stopped');
}

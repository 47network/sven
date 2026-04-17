// ---------------------------------------------------------------------------
// @sven/trading-platform — Portfolio Analytics
// ---------------------------------------------------------------------------
// Equity curve analysis, drawdown computation, rolling metrics, risk-adjusted
// returns, correlation matrix, and exposure breakdown.
// ---------------------------------------------------------------------------

import type { TradePerformance } from '../oms/index.js';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface EquitySnapshot {
  timestamp: number;
  equity: number;
  cash: number;
  positionValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

export interface DrawdownPeriod {
  startTimestamp: number;
  troughTimestamp: number;
  endTimestamp: number | null;  // null = still in drawdown
  peakEquity: number;
  troughEquity: number;
  drawdownPct: number;
  durationMs: number;
  recovered: boolean;
}

export interface RollingMetrics {
  timestamp: number;
  sharpe: number;
  sortino: number;
  volatility: number;
  winRate: number;
  avgReturn: number;
}

export interface ExposureBreakdown {
  byAsset: Record<string, { value: number; pct: number }>;
  byDirection: { long: number; short: number; net: number };
  bySector: Record<string, { value: number; pct: number }>;
  totalExposure: number;
  leverageRatio: number;
}

export interface CorrelationEntry {
  symbolA: string;
  symbolB: string;
  correlation: number;
  period: number; // bars used
}

export interface PortfolioAnalytics {
  equityCurve: EquitySnapshot[];
  drawdowns: DrawdownPeriod[];
  maxDrawdown: DrawdownPeriod | null;
  rollingMetrics: RollingMetrics[];
  dailyReturns: number[];
  annualizedReturn: number;
  annualizedVolatility: number;
  calmarRatio: number;
  exposure: ExposureBreakdown;
  correlations: CorrelationEntry[];
  generatedAt: string;
}

/* ── Equity Curve Builder ──────────────────────────────────────────────── */

export function buildEquityCurve(
  snapshots: Array<{ timestamp: number; equity: number; cash: number; positionValue: number }>,
): EquitySnapshot[] {
  if (snapshots.length === 0) return [];

  const initial = snapshots[0].equity;
  let prevEquity = initial;

  return snapshots.map((s) => {
    const dailyReturn = prevEquity > 0 ? (s.equity - prevEquity) / prevEquity : 0;
    const cumulativeReturn = initial > 0 ? (s.equity - initial) / initial : 0;
    prevEquity = s.equity;
    return { ...s, dailyReturn, cumulativeReturn };
  });
}

/* ── Drawdown Analysis ─────────────────────────────────────────────────── */

export function computeDrawdowns(equityCurve: EquitySnapshot[]): DrawdownPeriod[] {
  const drawdowns: DrawdownPeriod[] = [];
  let peak = equityCurve[0]?.equity ?? 0;
  let peakTs = equityCurve[0]?.timestamp ?? 0;
  let current: DrawdownPeriod | null = null;

  for (const point of equityCurve) {
    if (point.equity >= peak) {
      // New peak — close current drawdown if any
      if (current) {
        current.endTimestamp = point.timestamp;
        current.recovered = true;
        current.durationMs = point.timestamp - current.startTimestamp;
        drawdowns.push(current);
        current = null;
      }
      peak = point.equity;
      peakTs = point.timestamp;
    } else {
      const ddPct = ((peak - point.equity) / peak) * 100;

      if (!current) {
        current = {
          startTimestamp: peakTs,
          troughTimestamp: point.timestamp,
          endTimestamp: null,
          peakEquity: peak,
          troughEquity: point.equity,
          drawdownPct: ddPct,
          durationMs: point.timestamp - peakTs,
          recovered: false,
        };
      } else if (point.equity < current.troughEquity) {
        current.troughTimestamp = point.timestamp;
        current.troughEquity = point.equity;
        current.drawdownPct = ddPct;
        current.durationMs = point.timestamp - current.startTimestamp;
      }
    }
  }

  // Close open drawdown
  if (current) {
    current.durationMs = (equityCurve[equityCurve.length - 1]?.timestamp ?? 0) - current.startTimestamp;
    drawdowns.push(current);
  }

  return drawdowns;
}

export function findMaxDrawdown(drawdowns: DrawdownPeriod[]): DrawdownPeriod | null {
  if (drawdowns.length === 0) return null;
  return drawdowns.reduce((max, d) => d.drawdownPct > max.drawdownPct ? d : max);
}

/* ── Rolling Metrics ───────────────────────────────────────────────────── */

export function computeRollingMetrics(
  dailyReturns: number[],
  timestamps: number[],
  windowSize: number = 30,
): RollingMetrics[] {
  const results: RollingMetrics[] = [];

  for (let i = windowSize; i <= dailyReturns.length; i++) {
    const window = dailyReturns.slice(i - windowSize, i);
    const mean = window.reduce((s, r) => s + r, 0) / windowSize;
    const variance = window.reduce((s, r) => s + (r - mean) ** 2, 0) / windowSize;
    const stdDev = Math.sqrt(variance);
    const downsideVariance = window.reduce((s, r) => s + Math.min(0, r - mean) ** 2, 0) / windowSize;
    const downsideDev = Math.sqrt(downsideVariance);
    const wins = window.filter((r) => r > 0).length;

    results.push({
      timestamp: timestamps[i - 1] ?? 0,
      sharpe: stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0,
      sortino: downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0,
      volatility: stdDev * Math.sqrt(252) * 100,
      winRate: wins / windowSize,
      avgReturn: mean * 100,
    });
  }

  return results;
}

/* ── Annualized Metrics ────────────────────────────────────────────────── */

export function computeAnnualizedReturn(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0;
  const cumulativeReturn = dailyReturns.reduce((prod, r) => prod * (1 + r), 1);
  const years = dailyReturns.length / 252;
  return years > 0 ? (Math.pow(cumulativeReturn, 1 / years) - 1) * 100 : 0;
}

export function computeAnnualizedVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function computeCalmarRatio(annualizedReturn: number, maxDrawdownPct: number): number {
  return maxDrawdownPct > 0 ? annualizedReturn / maxDrawdownPct : 0;
}

/* ── Exposure Breakdown ────────────────────────────────────────────────── */

export function computeExposure(
  positions: Array<{ symbol: string; side: 'long' | 'short'; quantity: number; currentPrice: number; sector?: string }>,
  totalEquity: number,
): ExposureBreakdown {
  const byAsset: Record<string, { value: number; pct: number }> = {};
  const bySector: Record<string, { value: number; pct: number }> = {};
  let longValue = 0;
  let shortValue = 0;
  let totalExposure = 0;

  for (const pos of positions) {
    const value = Math.abs(pos.quantity * pos.currentPrice);
    totalExposure += value;

    if (pos.side === 'long') longValue += value;
    else shortValue += value;

    byAsset[pos.symbol] = {
      value,
      pct: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
    };

    const sector = pos.sector ?? 'unknown';
    const existing = bySector[sector] ?? { value: 0, pct: 0 };
    existing.value += value;
    existing.pct = totalEquity > 0 ? (existing.value / totalEquity) * 100 : 0;
    bySector[sector] = existing;
  }

  return {
    byAsset,
    byDirection: {
      long: longValue,
      short: shortValue,
      net: longValue - shortValue,
    },
    bySector,
    totalExposure,
    leverageRatio: totalEquity > 0 ? totalExposure / totalEquity : 0,
  };
}

/* ── Correlation Matrix ────────────────────────────────────────────────── */

export function computeCorrelation(returnsA: number[], returnsB: number[]): number {
  const n = Math.min(returnsA.length, returnsB.length);
  if (n < 2) return 0;

  const meanA = returnsA.slice(0, n).reduce((s, r) => s + r, 0) / n;
  const meanB = returnsB.slice(0, n).reduce((s, r) => s + r, 0) / n;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = returnsA[i] - meanA;
    const db = returnsB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

export function buildCorrelationMatrix(
  returnSeries: Record<string, number[]>,
): CorrelationEntry[] {
  const symbols = Object.keys(returnSeries);
  const entries: CorrelationEntry[] = [];

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const a = returnSeries[symbols[i]];
      const b = returnSeries[symbols[j]];
      const n = Math.min(a.length, b.length);
      entries.push({
        symbolA: symbols[i],
        symbolB: symbols[j],
        correlation: computeCorrelation(a, b),
        period: n,
      });
    }
  }

  return entries;
}

/* ── Full Analytics Builder ────────────────────────────────────────────── */

export function buildPortfolioAnalytics(
  snapshots: Array<{ timestamp: number; equity: number; cash: number; positionValue: number }>,
  positions: Array<{ symbol: string; side: 'long' | 'short'; quantity: number; currentPrice: number; sector?: string }>,
  totalEquity: number,
  returnSeries?: Record<string, number[]>,
): PortfolioAnalytics {
  const equityCurve = buildEquityCurve(snapshots);
  const dailyReturns = equityCurve.map((s) => s.dailyReturn);
  const timestamps = equityCurve.map((s) => s.timestamp);
  const drawdowns = computeDrawdowns(equityCurve);
  const maxDrawdown = findMaxDrawdown(drawdowns);
  const annualizedReturn = computeAnnualizedReturn(dailyReturns);
  const annualizedVolatility = computeAnnualizedVolatility(dailyReturns);

  return {
    equityCurve,
    drawdowns,
    maxDrawdown,
    rollingMetrics: computeRollingMetrics(dailyReturns, timestamps),
    dailyReturns,
    annualizedReturn,
    annualizedVolatility,
    calmarRatio: computeCalmarRatio(annualizedReturn, maxDrawdown?.drawdownPct ?? 0),
    exposure: computeExposure(positions, totalEquity),
    correlations: returnSeries ? buildCorrelationMatrix(returnSeries) : [],
    generatedAt: new Date().toISOString(),
  };
}

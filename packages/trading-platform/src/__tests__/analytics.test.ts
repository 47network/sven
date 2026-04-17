// ---------------------------------------------------------------------------
// @sven/trading-platform — Analytics Unit Tests
// ---------------------------------------------------------------------------
import {
  buildEquityCurve,
  computeDrawdowns,
  findMaxDrawdown,
  computeRollingMetrics,
  computeAnnualizedReturn,
  computeAnnualizedVolatility,
  computeCalmarRatio,
} from '../analytics/index';

/* ── Equity Curve ────────────────────────────────────────── */

describe('buildEquityCurve', () => {
  it('returns empty for no snapshots', () => {
    expect(buildEquityCurve([])).toEqual([]);
  });

  it('computes daily and cumulative returns', () => {
    const curve = buildEquityCurve([
      { timestamp: 1, equity: 10000, cash: 5000, positionValue: 5000 },
      { timestamp: 2, equity: 10500, cash: 5000, positionValue: 5500 },
      { timestamp: 3, equity: 10200, cash: 5000, positionValue: 5200 },
    ]);
    expect(curve).toHaveLength(3);
    // First snapshot: return from prev = 0 (initial)
    expect(curve[0].dailyReturn).toBe(0);
    expect(curve[0].cumulativeReturn).toBe(0);
    // Second: (10500-10000)/10000 = 0.05
    expect(curve[1].dailyReturn).toBeCloseTo(0.05);
    expect(curve[1].cumulativeReturn).toBeCloseTo(0.05);
    // Third: (10200-10500)/10500 = -0.0286
    expect(curve[2].dailyReturn).toBeCloseTo(-0.02857, 4);
    expect(curve[2].cumulativeReturn).toBeCloseTo(0.02);
  });
});

/* ── Drawdowns ───────────────────────────────────────────── */

describe('computeDrawdowns', () => {
  it('returns no drawdowns for monotonically increasing curve', () => {
    const curve = buildEquityCurve([
      { timestamp: 1, equity: 100, cash: 50, positionValue: 50 },
      { timestamp: 2, equity: 110, cash: 50, positionValue: 60 },
      { timestamp: 3, equity: 120, cash: 50, positionValue: 70 },
    ]);
    expect(computeDrawdowns(curve)).toHaveLength(0);
  });

  it('detects a drawdown and recovery', () => {
    const curve = buildEquityCurve([
      { timestamp: 1, equity: 100, cash: 50, positionValue: 50 },
      { timestamp: 2, equity: 110, cash: 50, positionValue: 60 },
      { timestamp: 3, equity: 95, cash: 50, positionValue: 45 },
      { timestamp: 4, equity: 115, cash: 50, positionValue: 65 },
    ]);
    const dds = computeDrawdowns(curve);
    expect(dds).toHaveLength(1);
    expect(dds[0].recovered).toBe(true);
    expect(dds[0].peakEquity).toBe(110);
    expect(dds[0].troughEquity).toBe(95);
    expect(dds[0].drawdownPct).toBeCloseTo(13.636, 2);
  });

  it('leaves unrecovered drawdown open', () => {
    const curve = buildEquityCurve([
      { timestamp: 1, equity: 100, cash: 50, positionValue: 50 },
      { timestamp: 2, equity: 110, cash: 50, positionValue: 60 },
      { timestamp: 3, equity: 90, cash: 50, positionValue: 40 },
    ]);
    const dds = computeDrawdowns(curve);
    expect(dds).toHaveLength(1);
    expect(dds[0].recovered).toBe(false);
    expect(dds[0].endTimestamp).toBeNull();
  });
});

describe('findMaxDrawdown', () => {
  it('returns null for empty list', () => {
    expect(findMaxDrawdown([])).toBeNull();
  });

  it('returns the deepest drawdown', () => {
    const dds = [
      { startTimestamp: 1, troughTimestamp: 2, endTimestamp: 3, peakEquity: 100, troughEquity: 90, drawdownPct: 10, durationMs: 2, recovered: true },
      { startTimestamp: 5, troughTimestamp: 6, endTimestamp: 7, peakEquity: 110, troughEquity: 80, drawdownPct: 27.27, durationMs: 2, recovered: true },
    ];
    const max = findMaxDrawdown(dds);
    expect(max?.drawdownPct).toBeCloseTo(27.27);
  });
});

/* ── Rolling Metrics ─────────────────────────────────────── */

describe('computeRollingMetrics', () => {
  it('returns empty for insufficient data', () => {
    const returns = [0.01, 0.02, -0.01];
    const timestamps = [1, 2, 3];
    const result = computeRollingMetrics(returns, timestamps, 5);
    expect(result).toHaveLength(0);
  });

  it('computes rolling window metrics', () => {
    const returns = Array.from({ length: 40 }, (_, i) => (i % 3 === 0 ? -0.01 : 0.015));
    const timestamps = returns.map((_, i) => i + 1);
    const result = computeRollingMetrics(returns, timestamps, 30);
    expect(result.length).toBeGreaterThan(0);
    for (const m of result) {
      expect(typeof m.sharpe).toBe('number');
      expect(typeof m.sortino).toBe('number');
      expect(typeof m.winRate).toBe('number');
      expect(m.winRate).toBeGreaterThanOrEqual(0);
      expect(m.winRate).toBeLessThanOrEqual(1);
    }
  });
});

/* ── Annualized Metrics ──────────────────────────────────── */

describe('computeAnnualizedReturn', () => {
  it('returns 0 for empty returns', () => {
    expect(computeAnnualizedReturn([])).toBe(0);
  });

  it('computes positive annualized return', () => {
    const returns = Array(252).fill(0.001); // 0.1% per day
    const annualized = computeAnnualizedReturn(returns);
    expect(annualized).toBeGreaterThan(20); // ~28%
    expect(annualized).toBeLessThan(35);
  });
});

describe('computeAnnualizedVolatility', () => {
  it('returns 0 for insufficient data', () => {
    expect(computeAnnualizedVolatility([0.01])).toBe(0);
  });

  it('computes volatility', () => {
    const returns = [0.01, -0.01, 0.02, -0.02, 0.01, -0.01];
    const vol = computeAnnualizedVolatility(returns);
    expect(vol).toBeGreaterThan(0);
  });
});

describe('computeCalmarRatio', () => {
  it('returns 0 when max drawdown is 0', () => {
    expect(computeCalmarRatio(15, 0)).toBe(0);
  });

  it('computes ratio correctly', () => {
    expect(computeCalmarRatio(20, 10)).toBe(2);
  });
});

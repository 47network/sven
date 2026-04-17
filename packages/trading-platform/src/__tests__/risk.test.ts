// ---------------------------------------------------------------------------
// @sven/trading-platform — Risk Management Unit Tests
// ---------------------------------------------------------------------------
import {
  checkMaxPositionSize,
  checkMaxExposure,
  checkDailyLoss,
  checkMinConfidence,
  checkMandatoryStopLoss,
  runAllRiskChecks,
  riskChecksPassed,
  fixedFractionalSize,
  kellyCriterionSize,
  volatilityBasedSize,
  confidenceWeightedSize,
  evaluateCircuitBreakers,
  anyBreakerTripped,
  DEFAULT_CIRCUIT_CONFIG,
} from '../risk/index';
import type { Signal, StrategyContext, RiskConfig } from '../engine/index';

const makeSignal = (overrides: Partial<Signal> = {}): Signal => ({
  id: 'sig-1',
  symbol: 'BTCUSDT',
  direction: 'long',
  strength: 0.8,
  source: 'test',
  createdAt: new Date(),
  metadata: {},
  ...overrides,
});

const makeContext = (overrides: Partial<StrategyContext> = {}): StrategyContext => ({
  capital: 100_000,
  positions: new Map(),
  openOrders: 0,
  dailyPnl: 0,
  drawdown: 0,
  timestamp: new Date(),
  ...overrides,
});

const makeConfig = (overrides: Partial<RiskConfig> = {}): RiskConfig => ({
  maxPositionPct: 0.05,
  maxExposurePct: 0.50,
  maxDailyLossPct: 0.03,
  minConfidence: 0.65,
  mandatoryStopLoss: true,
  ...overrides,
});

/* ── Pre-Trade Risk Checks ───────────────────────────────── */

describe('checkMaxPositionSize', () => {
  it('passes when within limit', () => {
    const signal = makeSignal({ sizePct: 0.03 });
    const result = checkMaxPositionSize(signal, makeContext(), makeConfig());
    expect(result.passed).toBe(true);
    expect(result.rule).toBe('max_position_size');
  });

  it('fails when exceeding limit', () => {
    const signal = makeSignal({ sizePct: 0.10 });
    const result = checkMaxPositionSize(signal, makeContext(), makeConfig());
    expect(result.passed).toBe(false);
  });
});

describe('checkMaxExposure', () => {
  it('passes with no positions', () => {
    const result = checkMaxExposure(makeContext(), makeConfig());
    expect(result.passed).toBe(true);
  });

  it('fails when exposure exceeds limit', () => {
    const positions = new Map();
    positions.set('BTCUSDT', {
      symbol: 'BTCUSDT', side: 'long', quantity: 1,
      entryPrice: 60000, currentPrice: 60000,
      unrealizedPnl: 0,
    });
    const ctx = makeContext({ capital: 100_000, positions });
    const config = makeConfig({ maxExposurePct: 0.50 });
    const result = checkMaxExposure(ctx, config);
    expect(result.passed).toBe(false);
  });
});

describe('checkDailyLoss', () => {
  it('passes when no loss', () => {
    const result = checkDailyLoss(makeContext({ dailyPnl: 500 }), makeConfig());
    expect(result.passed).toBe(true);
  });

  it('fails when daily loss exceeds limit', () => {
    const result = checkDailyLoss(makeContext({ dailyPnl: -4000 }), makeConfig({ maxDailyLossPct: 0.03 }));
    expect(result.passed).toBe(false);
  });
});

describe('checkMinConfidence', () => {
  it('passes above threshold', () => {
    const result = checkMinConfidence(makeSignal({ strength: 0.80 }), makeConfig());
    expect(result.passed).toBe(true);
  });

  it('fails below threshold', () => {
    const result = checkMinConfidence(makeSignal({ strength: 0.50 }), makeConfig());
    expect(result.passed).toBe(false);
  });
});

describe('checkMandatoryStopLoss', () => {
  it('passes with stop loss set', () => {
    const result = checkMandatoryStopLoss(makeSignal({ stopLoss: 48000 }), makeConfig());
    expect(result.passed).toBe(true);
  });

  it('fails when missing stop loss', () => {
    const result = checkMandatoryStopLoss(makeSignal(), makeConfig());
    expect(result.passed).toBe(false);
  });

  it('passes when stop loss not mandatory', () => {
    const result = checkMandatoryStopLoss(makeSignal(), makeConfig({ mandatoryStopLoss: false }));
    expect(result.passed).toBe(true);
  });
});

describe('runAllRiskChecks', () => {
  it('returns 5 check results', () => {
    const results = runAllRiskChecks(makeSignal({ stopLoss: 49000 }), makeContext(), makeConfig());
    expect(results).toHaveLength(5);
  });
});

describe('riskChecksPassed', () => {
  it('returns true when all pass', () => {
    const signal = makeSignal({ sizePct: 0.02, stopLoss: 49000 });
    const results = runAllRiskChecks(signal, makeContext(), makeConfig());
    expect(riskChecksPassed(results)).toBe(true);
  });

  it('returns false when any fails', () => {
    const signal = makeSignal({ sizePct: 0.02, strength: 0.30 });
    const results = runAllRiskChecks(signal, makeContext(), makeConfig());
    expect(riskChecksPassed(results)).toBe(false);
  });
});

/* ── Position Sizing ─────────────────────────────────────── */

describe('fixedFractionalSize', () => {
  it('calculates correct size', () => {
    // risk 2% of 100k, entry 50000, stop 49000, risk per unit = 1000
    const size = fixedFractionalSize(100_000, 0.02, 50000, 49000);
    expect(size).toBe(2); // 2000 / 1000
  });

  it('returns 0 when stop equals entry', () => {
    expect(fixedFractionalSize(100_000, 0.02, 50000, 50000)).toBe(0);
  });

  it('returns 0 when entry is 0', () => {
    expect(fixedFractionalSize(100_000, 0.02, 0, 0)).toBe(0);
  });
});

describe('kellyCriterionSize', () => {
  it('calculates half-kelly', () => {
    // 60% win rate, 2:1 reward/risk
    const size = kellyCriterionSize(0.6, 2, 1, 0.5);
    // full kelly = (0.6*2 - 0.4)/2 = (1.2-0.4)/2 = 0.4
    // half kelly = 0.2
    expect(size).toBeCloseTo(0.2);
  });

  it('returns 0 when avg loss is 0', () => {
    expect(kellyCriterionSize(0.5, 1, 0)).toBe(0);
  });

  it('clamps to 0 for negative kelly', () => {
    const size = kellyCriterionSize(0.2, 1, 1, 1.0);
    expect(size).toBe(0);
  });
});

describe('volatilityBasedSize', () => {
  it('calculates correct size', () => {
    const size = volatilityBasedSize(100_000, 500, 0.01, 50000);
    expect(size).toBe(2); // 1000 / 500
  });

  it('returns 0 when ATR is 0', () => {
    expect(volatilityBasedSize(100_000, 0, 0.01, 50000)).toBe(0);
  });
});

describe('confidenceWeightedSize', () => {
  it('scales size by confidence', () => {
    const size = confidenceWeightedSize(10, 0.90, 0.60);
    // scale = (0.90 - 0.60) / (1.0 - 0.60) = 0.75
    expect(size).toBeCloseTo(7.5);
  });

  it('returns 0 below min confidence', () => {
    expect(confidenceWeightedSize(10, 0.50, 0.60)).toBe(0);
  });
});

/* ── Circuit Breakers ────────────────────────────────────── */

describe('evaluateCircuitBreakers', () => {
  it('returns no tripped breakers in normal conditions', () => {
    const ctx = makeContext({ dailyPnl: 500, drawdown: 0.02 });
    const breakers = evaluateCircuitBreakers(ctx, DEFAULT_CIRCUIT_CONFIG, 0, 0.01, 0.9);
    expect(breakers).toHaveLength(5);
    expect(anyBreakerTripped(breakers)).toBe(false);
  });

  it('trips daily loss breaker', () => {
    const ctx = makeContext({ dailyPnl: -5000 }); // 5% of 100k
    const breakers = evaluateCircuitBreakers(ctx, DEFAULT_CIRCUIT_CONFIG, 0, 0, 0.9);
    const dailyLoss = breakers.find((b) => b.id === 'daily-loss');
    expect(dailyLoss?.isTripped).toBe(true);
    expect(dailyLoss?.action).toBe('halt_trading');
  });

  it('trips consecutive loss breaker', () => {
    const ctx = makeContext();
    const breakers = evaluateCircuitBreakers(ctx, DEFAULT_CIRCUIT_CONFIG, 6, 0, 0.9);
    const consec = breakers.find((b) => b.id === 'consecutive-losses');
    expect(consec?.isTripped).toBe(true);
    expect(consec?.action).toBe('pause_and_review');
  });

  it('trips flash crash breaker', () => {
    const ctx = makeContext();
    const breakers = evaluateCircuitBreakers(ctx, DEFAULT_CIRCUIT_CONFIG, 0, -0.12, 0.9);
    const flash = breakers.find((b) => b.id === 'flash-crash');
    expect(flash?.isTripped).toBe(true);
    expect(flash?.action).toBe('close_all');
  });

  it('trips model disagreement breaker', () => {
    const ctx = makeContext();
    const breakers = evaluateCircuitBreakers(ctx, DEFAULT_CIRCUIT_CONFIG, 0, 0, 0.3);
    const model = breakers.find((b) => b.id === 'model-disagreement');
    expect(model?.isTripped).toBe(true);
    expect(model?.action).toBe('paper_only');
  });
});

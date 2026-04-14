// ---------------------------------------------------------------------------
// @sven/trading-platform — Risk Management & Position Sizing
// ---------------------------------------------------------------------------
// Pre-trade risk rules, position sizing models (fixed fractional, Kelly,
// volatility-based, confidence-weighted), circuit breakers, exposure tracking.
// ---------------------------------------------------------------------------

import type { Signal, StrategyContext, RiskConfig } from '../engine/index.js';

/* ── Risk Rule Results ─────────────────────────────────────────────────── */

export interface RiskCheckResult {
  passed: boolean;
  rule: string;
  message: string;
  threshold: number;
  actual: number;
}

/* ── Pre-Trade Risk Rules ──────────────────────────────────────────────── */

export function checkMaxPositionSize(signal: Signal, context: StrategyContext, config: RiskConfig): RiskCheckResult {
  const sizePct = signal.sizePct ?? config.maxPositionPct;
  return {
    passed: sizePct <= config.maxPositionPct,
    rule: 'max_position_size',
    message: sizePct <= config.maxPositionPct ? 'Within position limit' : `Position ${(sizePct * 100).toFixed(1)}% exceeds max ${(config.maxPositionPct * 100).toFixed(1)}%`,
    threshold: config.maxPositionPct,
    actual: sizePct,
  };
}

export function checkMaxExposure(context: StrategyContext, config: RiskConfig): RiskCheckResult {
  let totalExposure = 0;
  for (const pos of context.positions.values()) {
    totalExposure += Math.abs(pos.quantity * pos.currentPrice);
  }
  const exposurePct = context.capital > 0 ? totalExposure / context.capital : 0;
  return {
    passed: exposurePct <= config.maxExposurePct,
    rule: 'max_total_exposure',
    message: exposurePct <= config.maxExposurePct ? 'Within exposure limit' : `Exposure ${(exposurePct * 100).toFixed(1)}% exceeds max ${(config.maxExposurePct * 100).toFixed(1)}%`,
    threshold: config.maxExposurePct,
    actual: exposurePct,
  };
}

export function checkDailyLoss(context: StrategyContext, config: RiskConfig): RiskCheckResult {
  const lossPct = context.capital > 0 ? Math.abs(Math.min(0, context.dailyPnl)) / context.capital : 0;
  return {
    passed: lossPct <= config.maxDailyLossPct,
    rule: 'max_daily_loss',
    message: lossPct <= config.maxDailyLossPct ? 'Within daily loss limit' : `Daily loss ${(lossPct * 100).toFixed(1)}% exceeds max ${(config.maxDailyLossPct * 100).toFixed(1)}%`,
    threshold: config.maxDailyLossPct,
    actual: lossPct,
  };
}

export function checkMinConfidence(signal: Signal, config: RiskConfig): RiskCheckResult {
  return {
    passed: signal.strength >= config.minConfidence,
    rule: 'min_confidence',
    message: signal.strength >= config.minConfidence ? 'Confidence sufficient' : `Confidence ${signal.strength.toFixed(2)} below minimum ${config.minConfidence.toFixed(2)}`,
    threshold: config.minConfidence,
    actual: signal.strength,
  };
}

export function checkMandatoryStopLoss(signal: Signal, config: RiskConfig): RiskCheckResult {
  const hasStopLoss = signal.stopLoss != null && signal.stopLoss > 0;
  return {
    passed: !config.mandatoryStopLoss || hasStopLoss,
    rule: 'mandatory_stop_loss',
    message: hasStopLoss ? 'Stop loss set' : 'Missing mandatory stop-loss',
    threshold: 1,
    actual: hasStopLoss ? 1 : 0,
  };
}

export function runAllRiskChecks(signal: Signal, context: StrategyContext, config: RiskConfig): RiskCheckResult[] {
  return [
    checkMaxPositionSize(signal, context, config),
    checkMaxExposure(context, config),
    checkDailyLoss(context, config),
    checkMinConfidence(signal, config),
    checkMandatoryStopLoss(signal, config),
  ];
}

export function riskChecksPassed(results: RiskCheckResult[]): boolean {
  return results.every((r) => r.passed);
}

/* ── Position Sizing Models ────────────────────────────────────────────── */

/**
 * Fixed fractional: risk X% of capital per trade.
 * Returns the number of units/contracts to buy.
 */
export function fixedFractionalSize(capital: number, riskPct: number, entryPrice: number, stopLossPrice: number): number {
  const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
  if (riskPerUnit === 0 || entryPrice === 0) return 0;
  const capitalAtRisk = capital * riskPct;
  return capitalAtRisk / riskPerUnit;
}

/**
 * Kelly Criterion: optimal sizing based on win rate and reward/risk ratio.
 * Returns fraction of capital to deploy (use fractional Kelly, e.g. fraction=0.5 for half-Kelly).
 */
export function kellyCriterionSize(winRate: number, avgWin: number, avgLoss: number, fraction: number = 0.5): number {
  if (avgLoss === 0) return 0;
  const b = avgWin / avgLoss;
  const kelly = (winRate * b - (1 - winRate)) / b;
  return Math.max(0, Math.min(1, kelly * fraction));
}

/**
 * Volatility-based: size inversely proportional to Average True Range (ATR).
 * Higher volatility → smaller position.
 */
export function volatilityBasedSize(capital: number, atr: number, riskPct: number, entryPrice: number): number {
  if (atr === 0 || entryPrice === 0) return 0;
  const capitalAtRisk = capital * riskPct;
  return capitalAtRisk / atr;
}

/**
 * Confidence-weighted: scale a base size by prediction confidence.
 */
export function confidenceWeightedSize(baseSize: number, confidence: number, minConfidence: number): number {
  if (confidence < minConfidence) return 0;
  const scale = (confidence - minConfidence) / (1 - minConfidence);
  return baseSize * scale;
}

/* ── Circuit Breakers ──────────────────────────────────────────────────── */

export type CircuitBreakerAction = 'halt_trading' | 'reduce_size' | 'pause_and_review' | 'close_all' | 'paper_only';

export interface CircuitBreaker {
  id: string;
  name: string;
  description: string;
  action: CircuitBreakerAction;
  isTripped: boolean;
  trippedAt?: Date;
  resetAt?: Date;
}

export interface CircuitBreakerConfig {
  dailyLossThreshold: number;       // % loss to halt trading (default -3%)
  drawdownThreshold: number;        // % drawdown to reduce size (default -10%)
  consecutiveLossCount: number;     // consecutive losses to pause (default 5)
  flashCrashDropPct: number;        // % price drop for flash crash (default 10%)
  flashCrashTimeWindowMs: number;   // time window for flash crash detection (default 60_000)
  modelDisagreementThreshold: number; // divergence threshold for paper-only mode (default 0.4)
  cooldownAfterLossMs: number;      // cooldown ms after losing trade (default 900_000 / 15min)
  maxOpenOrders: number;            // max simultaneous orders (default 20)
  maxSlippagePct: number;           // max slippage tolerance (default 0.005)
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  dailyLossThreshold: 0.03,
  drawdownThreshold: 0.10,
  consecutiveLossCount: 5,
  flashCrashDropPct: 0.10,
  flashCrashTimeWindowMs: 60_000,
  modelDisagreementThreshold: 0.40,
  cooldownAfterLossMs: 900_000,
  maxOpenOrders: 20,
  maxSlippagePct: 0.005,
};

export function evaluateCircuitBreakers(
  context: StrategyContext,
  config: CircuitBreakerConfig,
  consecutiveLosses: number,
  recentPriceChangePct: number,
  modelAgreementScore: number,
): CircuitBreaker[] {
  const breakers: CircuitBreaker[] = [];
  const now = new Date();

  // Daily loss breaker
  const dailyLossPct = context.capital > 0 ? Math.abs(Math.min(0, context.dailyPnl)) / context.capital : 0;
  breakers.push({
    id: 'daily-loss',
    name: 'Daily Loss Breaker',
    description: 'Halt trading when daily loss exceeds threshold',
    action: 'halt_trading',
    isTripped: dailyLossPct >= config.dailyLossThreshold,
    trippedAt: dailyLossPct >= config.dailyLossThreshold ? now : undefined,
  });

  // Drawdown breaker
  breakers.push({
    id: 'drawdown',
    name: 'Drawdown Breaker',
    description: 'Reduce position sizes when drawdown exceeds threshold',
    action: 'reduce_size',
    isTripped: context.drawdown >= config.drawdownThreshold,
    trippedAt: context.drawdown >= config.drawdownThreshold ? now : undefined,
  });

  // Consecutive loss breaker
  breakers.push({
    id: 'consecutive-losses',
    name: 'Consecutive Loss Breaker',
    description: 'Pause and review after consecutive losing trades',
    action: 'pause_and_review',
    isTripped: consecutiveLosses >= config.consecutiveLossCount,
    trippedAt: consecutiveLosses >= config.consecutiveLossCount ? now : undefined,
  });

  // Flash crash breaker
  breakers.push({
    id: 'flash-crash',
    name: 'Flash Crash Breaker',
    description: 'Close all positions on flash crash detection',
    action: 'close_all',
    isTripped: Math.abs(recentPriceChangePct) >= config.flashCrashDropPct,
    trippedAt: Math.abs(recentPriceChangePct) >= config.flashCrashDropPct ? now : undefined,
  });

  // Model disagreement breaker
  breakers.push({
    id: 'model-disagreement',
    name: 'Model Disagreement Breaker',
    description: 'Switch to paper-only when models strongly disagree',
    action: 'paper_only',
    isTripped: modelAgreementScore < (1 - config.modelDisagreementThreshold),
    trippedAt: modelAgreementScore < (1 - config.modelDisagreementThreshold) ? now : undefined,
  });

  return breakers;
}

export function anyBreakerTripped(breakers: CircuitBreaker[]): boolean {
  return breakers.some((b) => b.isTripped);
}

export function getTrippedActions(breakers: CircuitBreaker[]): CircuitBreakerAction[] {
  return breakers.filter((b) => b.isTripped).map((b) => b.action);
}

/* ── Drawdown Tracking ─────────────────────────────────────────────────── */

export function calculateDrawdown(equityCurve: number[]): { maxDrawdown: number; currentDrawdown: number } {
  if (equityCurve.length === 0) return { maxDrawdown: 0, currentDrawdown: 0 };

  let peak = equityCurve[0]!;
  let maxDrawdown = 0;

  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const current = equityCurve[equityCurve.length - 1]!;
  const currentDrawdown = (peak - current) / peak;

  return { maxDrawdown, currentDrawdown };
}

/* ── Correlation Exposure ──────────────────────────────────────────────── */

export interface CorrelationGroup {
  name: string;
  symbols: string[];
  maxExposurePct: number;
}

export const DEFAULT_CORRELATION_GROUPS: CorrelationGroup[] = [
  { name: 'BTC-ecosystem', symbols: ['BTC/USDT', 'WBTC/USDT'], maxExposurePct: 0.20 },
  { name: 'ETH-ecosystem', symbols: ['ETH/USDT', 'stETH/USDT'], maxExposurePct: 0.20 },
  { name: 'Layer-1', symbols: ['SOL/USDT', 'AVAX/USDT', 'ADA/USDT', 'DOT/USDT'], maxExposurePct: 0.20 },
  { name: 'Meme-coins', symbols: ['DOGE/USDT', 'SHIB/USDT', 'PEPE/USDT'], maxExposurePct: 0.10 },
];

export function checkCorrelatedExposure(
  positions: Map<string, { quantity: number; currentPrice: number }>,
  capital: number,
  groups: CorrelationGroup[] = DEFAULT_CORRELATION_GROUPS,
): RiskCheckResult[] {
  const results: RiskCheckResult[] = [];

  for (const group of groups) {
    let groupExposure = 0;
    for (const sym of group.symbols) {
      const pos = positions.get(sym);
      if (pos) groupExposure += Math.abs(pos.quantity * pos.currentPrice);
    }
    const exposurePct = capital > 0 ? groupExposure / capital : 0;
    results.push({
      passed: exposurePct <= group.maxExposurePct,
      rule: `correlated_exposure_${group.name}`,
      message: exposurePct <= group.maxExposurePct
        ? `${group.name} within limit`
        : `${group.name} exposure ${(exposurePct * 100).toFixed(1)}% exceeds ${(group.maxExposurePct * 100).toFixed(1)}%`,
      threshold: group.maxExposurePct,
      actual: exposurePct,
    });
  }

  return results;
}

/* ── Risk / Reward Ratio ───────────────────────────────────────────────── */

export interface RiskRewardResult {
  readonly risk: number;       // absolute distance from entry to stop loss
  readonly reward: number;     // absolute distance from entry to take profit
  readonly ratio: number;      // reward / risk (higher = better)
  readonly favorable: boolean; // ratio >= 2.0 — reward is 2x+ the risk
}

/**
 * Compute risk-to-reward ratio for a trade setup.
 * Batch 8: Used in the autonomous decision pipeline to filter out
 * trades with poor risk/reward before execution.
 *
 * Validates that stop loss and take profit are on the correct side
 * of entry price for the given trade direction:
 *   LONG:  SL < entry < TP (profit from price going up)
 *   SHORT: TP < entry < SL (profit from price going down)
 *
 * Returns null if inputs are invalid.
 */
export function computeRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  side: 'long' | 'short',
): RiskRewardResult | null {
  if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) return null;
  if (entryPrice === stopLoss) return null; // zero risk = invalid setup

  let risk: number;
  let reward: number;

  if (side === 'long') {
    risk = entryPrice - stopLoss;      // SL must be below entry
    reward = takeProfit - entryPrice;  // TP must be above entry
  } else {
    risk = stopLoss - entryPrice;      // SL must be above entry
    reward = entryPrice - takeProfit;  // TP must be below entry
  }

  // If either is negative, inputs are on the wrong side
  if (risk <= 0 || reward <= 0) return null;

  const ratio = reward / risk;
  return { risk, reward, ratio, favorable: ratio >= 2.0 };
}

/* ── Batch 10E: Portfolio Correlation Guard ─────────────────────────────── */
// Full portfolio-level correlation analysis that goes beyond the simple
// pairwise veto in Batch 8. Computes a correlation matrix for all open
// positions + candidate, measures aggregate correlated exposure, and
// produces a heat score indicating concentration risk.

export interface PortfolioCorrelationResult {
  readonly allowed: boolean;
  readonly reason: string;
  readonly portfolioHeat: number;       // 0.0–1.0: aggregate concentration score
  readonly pairwiseCorrelations: Array<{
    readonly symbolA: string;
    readonly symbolB: string;
    readonly correlation: number;
  }>;
  readonly clusterExposurePct: number;  // % of capital in highly correlated cluster
  readonly maxPairCorrelation: number;  // highest |corr| with any open position
}

/**
 * Compute log returns from candle close prices (for correlation calculation).
 */
function candleLogReturns(candles: Array<{ close: number }>, maxPeriod = 50): number[] {
  const n = Math.min(candles.length, maxPeriod + 1);
  if (n < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = candles[i - 1].close;
    const cur = candles[i].close;
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  return returns;
}

/**
 * Pearson correlation between two return series.
 */
function pearsonReturns(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 10) return null;
  const meanA = a.slice(0, n).reduce((s, r) => s + r, 0) / n;
  const meanB = b.slice(0, n).reduce((s, r) => s + r, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 1e-15 ? cov / denom : null;
}

/**
 * Portfolio correlation guard — checks whether adding a new position
 * would create dangerous concentration in the portfolio.
 *
 * Rules:
 * 1. Max pairwise |corr| >= 0.85 with any same-direction open position → block
 * 2. Cluster exposure: sum of positions in the same correlated cluster (|corr| >= 0.70)
 *    must not exceed 30% of capital → block if exceeded
 * 3. Portfolio heat: weighted average of all pairwise |corr| values
 *    between open positions (including candidate), weighted by position size.
 *    Heat >= 0.75 → block (portfolio is too concentrated)
 */
export function portfolioCorrelationGuard(
  candidateSymbol: string,
  candidateDirection: 'long' | 'short',
  candidateCapitalPct: number,
  openPositions: Array<{
    symbol: string;
    side: 'long' | 'short';
    capitalPct: number;
    candles: Array<{ close: number }>;
  }>,
  candidateCandles: Array<{ close: number }>,
  config: {
    blockThreshold?: number;     // max pairwise |corr| → default 0.85
    clusterThreshold?: number;   // min |corr| to be in same cluster → default 0.70
    maxClusterPct?: number;      // max cluster capital % → default 0.30
    maxHeat?: number;            // max portfolio heat → default 0.75
  } = {},
): PortfolioCorrelationResult {
  const blockThreshold = config.blockThreshold ?? 0.85;
  const clusterThreshold = config.clusterThreshold ?? 0.70;
  const maxClusterPct = config.maxClusterPct ?? 0.30;
  const maxHeat = config.maxHeat ?? 0.75;

  const candidateReturns = candleLogReturns(candidateCandles);
  if (candidateReturns.length < 10) {
    return { allowed: true, reason: 'Insufficient data for correlation check', portfolioHeat: 0, pairwiseCorrelations: [], clusterExposurePct: 0, maxPairCorrelation: 0 };
  }

  // Compute pairwise correlations between candidate and all open positions
  const pairwise: PortfolioCorrelationResult['pairwiseCorrelations'] = [];
  let maxPairCorr = 0;
  let clusterExposure = candidateCapitalPct;

  for (const pos of openPositions) {
    if (pos.symbol === candidateSymbol) continue;
    const posReturns = candleLogReturns(pos.candles);
    const corr = pearsonReturns(candidateReturns, posReturns);
    if (corr === null) continue;

    pairwise.push({ symbolA: candidateSymbol, symbolB: pos.symbol, correlation: corr });
    const absCorr = Math.abs(corr);
    if (absCorr > maxPairCorr) maxPairCorr = absCorr;

    // Rule 1: Block if highly correlated with same-direction open position
    const sameDirection = candidateDirection === pos.side;
    if (sameDirection && absCorr >= blockThreshold) {
      return {
        allowed: false,
        reason: `Portfolio guard: ${candidateSymbol} has ${(corr * 100).toFixed(0)}% correlation with open ${pos.symbol} (same direction ${candidateDirection}) — exceeds ${(blockThreshold * 100).toFixed(0)}% threshold`,
        portfolioHeat: 0,
        pairwiseCorrelations: pairwise,
        clusterExposurePct: 0,
        maxPairCorrelation: absCorr,
      };
    }

    // Rule 2: Accumulate cluster exposure for highly correlated positions
    if (absCorr >= clusterThreshold) {
      clusterExposure += pos.capitalPct;
    }
  }

  // Rule 2: Check cluster exposure limit
  if (clusterExposure > maxClusterPct) {
    return {
      allowed: false,
      reason: `Portfolio guard: correlated cluster exposure ${(clusterExposure * 100).toFixed(1)}% exceeds ${(maxClusterPct * 100).toFixed(0)}% limit — ${candidateSymbol} correlates with ${pairwise.filter(p => Math.abs(p.correlation) >= clusterThreshold).map(p => p.symbolB).join(', ')}`,
      portfolioHeat: 0,
      pairwiseCorrelations: pairwise,
      clusterExposurePct: clusterExposure,
      maxPairCorrelation: maxPairCorr,
    };
  }

  // Rule 3: Compute portfolio heat (weighted average |corr|)
  // Include all pairwise between open positions too
  const allPositions = [...openPositions, { symbol: candidateSymbol, side: candidateDirection, capitalPct: candidateCapitalPct, candles: candidateCandles }];
  let heatNumerator = 0;
  let heatDenominator = 0;

  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const a = allPositions[i];
      const b = allPositions[j];
      const rA = candleLogReturns(a.candles);
      const rB = candleLogReturns(b.candles);
      const corr = pearsonReturns(rA, rB);
      if (corr === null) continue;
      const weight = (a.capitalPct + b.capitalPct) / 2;
      heatNumerator += Math.abs(corr) * weight;
      heatDenominator += weight;
    }
  }

  const portfolioHeat = heatDenominator > 0 ? heatNumerator / heatDenominator : 0;

  if (portfolioHeat >= maxHeat) {
    return {
      allowed: false,
      reason: `Portfolio guard: heat ${(portfolioHeat * 100).toFixed(0)}% exceeds ${(maxHeat * 100).toFixed(0)}% — portfolio too concentrated`,
      portfolioHeat,
      pairwiseCorrelations: pairwise,
      clusterExposurePct: clusterExposure,
      maxPairCorrelation: maxPairCorr,
    };
  }

  return {
    allowed: true,
    reason: 'Portfolio correlation check passed',
    portfolioHeat,
    pairwiseCorrelations: pairwise,
    clusterExposurePct: clusterExposure,
    maxPairCorrelation: maxPairCorr,
  };
}

// ---------------------------------------------------------------------------
// @sven/trading-platform — Technical Analysis Indicators
// ---------------------------------------------------------------------------
// Pure functions computing RSI, MACD, Bollinger Bands, and an aggregate
// technical signal from candle data. Fed into Sven's signal pipeline
// alongside Kronos BSQ and MiroFish agent simulation.
// ---------------------------------------------------------------------------

import type { Candle } from '../market-data/index.js';

/* ── RSI — Relative Strength Index ─────────────────────────────────────── */

export interface RSIResult {
  value: number;         // 0–100
  overbought: boolean;   // > 70
  oversold: boolean;     // < 30
  direction: 'long' | 'short' | 'neutral';
  strength: number;      // 0.0–1.0 signal strength
}

/**
 * Compute RSI using Wilder's smoothed moving average.
 * Period defaults to 14 (industry standard).
 */
export function computeRSI(candles: Candle[], period = 14): RSIResult | null {
  if (candles.length < period + 1) return null;

  const closes = candles.map(c => c.close);
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i]! - closes[i - 1]!);
  }

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const change = changes[i]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining periods
  for (let i = period; i < changes.length; i++) {
    const change = changes[i]!;
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  const overbought = rsi > 70;
  const oversold = rsi < 30;

  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  let strength = 0;

  if (oversold) {
    direction = 'long';
    strength = Math.min(1, (30 - rsi) / 30); // Deeper oversold = stronger signal
  } else if (overbought) {
    direction = 'short';
    strength = Math.min(1, (rsi - 70) / 30);
  } else if (rsi < 45) {
    direction = 'long';
    strength = (45 - rsi) / 45 * 0.3; // Weak bullish lean
  } else if (rsi > 55) {
    direction = 'short';
    strength = (rsi - 55) / 45 * 0.3; // Weak bearish lean
  }

  return { value: rsi, overbought, oversold, direction, strength };
}

/* ── MACD — Moving Average Convergence Divergence ──────────────────────── */

export interface MACDResult {
  macd: number;           // MACD line = EMA(12) - EMA(26)
  signal: number;         // Signal line = EMA(9) of MACD
  histogram: number;      // MACD - signal
  direction: 'long' | 'short' | 'neutral';
  strength: number;       // 0.0–1.0
  crossover: 'bullish' | 'bearish' | 'none';
}

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const multiplier = 2 / (period + 1);
  const ema: number[] = [values[0]!];

  for (let i = 1; i < values.length; i++) {
    ema.push((values[i]! - ema[i - 1]!) * multiplier + ema[i - 1]!);
  }
  return ema;
}

/**
 * Compute MACD with standard 12/26/9 periods.
 * Returns MACD line, signal line, histogram, crossover state.
 */
export function computeMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult | null {
  if (candles.length < slowPeriod + signalPeriod) return null;

  const closes = candles.map(c => c.close);
  const fastEMA = computeEMA(closes, fastPeriod);
  const slowEMA = computeEMA(closes, slowPeriod);

  // MACD line
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(fastEMA[i]! - slowEMA[i]!);
  }

  // Signal line (EMA of MACD)
  const signalLine = computeEMA(macdLine, signalPeriod);

  const lastIdx = macdLine.length - 1;
  const prevIdx = lastIdx - 1;

  if (lastIdx < 1) return null;

  const macd = macdLine[lastIdx]!;
  const signal = signalLine[lastIdx]!;
  const histogram = macd - signal;
  const prevMacd = macdLine[prevIdx]!;
  const prevSignal = signalLine[prevIdx]!;

  // Detect crossovers
  let crossover: 'bullish' | 'bearish' | 'none' = 'none';
  if (prevMacd <= prevSignal && macd > signal) crossover = 'bullish';
  else if (prevMacd >= prevSignal && macd < signal) crossover = 'bearish';

  // Normalize histogram strength relative to price
  const currentPrice = closes[lastIdx]!;
  const normalizedHist = currentPrice > 0 ? Math.abs(histogram) / currentPrice : 0;

  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  let strength = 0;

  if (crossover === 'bullish') {
    direction = 'long';
    strength = Math.min(1, 0.5 + normalizedHist * 100);
  } else if (crossover === 'bearish') {
    direction = 'short';
    strength = Math.min(1, 0.5 + normalizedHist * 100);
  } else if (histogram > 0) {
    direction = 'long';
    strength = Math.min(0.5, normalizedHist * 100);
  } else if (histogram < 0) {
    direction = 'short';
    strength = Math.min(0.5, normalizedHist * 100);
  }

  return { macd, signal: signal, histogram, direction, strength, crossover };
}

/* ── Bollinger Bands ───────────────────────────────────────────────────── */

export interface BollingerResult {
  upper: number;
  middle: number;        // SMA
  lower: number;
  bandwidth: number;     // (upper - lower) / middle — volatility measure
  percentB: number;      // (price - lower) / (upper - lower) — position within bands
  direction: 'long' | 'short' | 'neutral';
  strength: number;      // 0.0–1.0
  squeeze: boolean;      // bandwidth < 0.04 — volatility compression
}

/**
 * Compute Bollinger Bands with standard 20-period SMA and 2 standard deviations.
 */
export function computeBollinger(candles: Candle[], period = 20, stdDevMultiplier = 2): BollingerResult | null {
  if (candles.length < period) return null;

  const closes = candles.map(c => c.close);
  const recentCloses = closes.slice(-period);

  const sma = recentCloses.reduce((sum, v) => sum + v, 0) / period;
  const variance = recentCloses.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + stdDevMultiplier * stdDev;
  const lower = sma - stdDevMultiplier * stdDev;
  const currentPrice = closes[closes.length - 1]!;
  const bandwidth = sma > 0 ? (upper - lower) / sma : 0;
  const bandRange = upper - lower;
  const percentB = bandRange > 0 ? (currentPrice - lower) / bandRange : 0.5;
  const squeeze = bandwidth < 0.04;

  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  let strength = 0;

  if (percentB <= 0) {
    // Below lower band — oversold bounce signal
    direction = 'long';
    strength = Math.min(1, Math.abs(percentB) * 0.5 + 0.4);
  } else if (percentB >= 1) {
    // Above upper band — overbought reversal signal
    direction = 'short';
    strength = Math.min(1, (percentB - 1) * 0.5 + 0.4);
  } else if (percentB < 0.2) {
    direction = 'long';
    strength = (0.2 - percentB) / 0.2 * 0.4;
  } else if (percentB > 0.8) {
    direction = 'short';
    strength = (percentB - 0.8) / 0.2 * 0.4;
  }

  // Squeeze (low volatility) increases conviction of breakout when it happens
  if (squeeze && strength > 0) {
    strength = Math.min(1, strength * 1.3);
  }

  return { upper, middle: sma, lower, bandwidth, percentB, direction, strength, squeeze };
}

/* ── SMA Trend Filter ──────────────────────────────────────────────────── */

export interface TrendResult {
  sma50: number;
  currentPrice: number;
  aboveSMA: boolean;       // price above 50-SMA = uptrend
  trendDirection: 'up' | 'down' | 'flat';
  trendStrength: number;   // 0.0–1.0, distance from SMA as % of price
}

/**
 * Compute 50-period SMA and determine market trend.
 * Trading WITH the trend is the single most effective filter in crypto.
 * Price > SMA50 = uptrend (prefer longs), Price < SMA50 = downtrend (prefer shorts).
 */
export function computeTrendFilter(candles: Candle[], period = 50): TrendResult | null {
  if (candles.length < period) return null;

  const closes = candles.map(c => c.close);
  const recentCloses = closes.slice(-period);
  const sma50 = recentCloses.reduce((s, v) => s + v, 0) / period;
  const currentPrice = closes[closes.length - 1]!;

  const distancePct = (currentPrice - sma50) / sma50;
  const aboveSMA = currentPrice > sma50;

  // Flat if within 0.5% of SMA
  let trendDirection: 'up' | 'down' | 'flat' = 'flat';
  if (distancePct > 0.005) trendDirection = 'up';
  else if (distancePct < -0.005) trendDirection = 'down';

  // Strength: how far from SMA (capped at 5% = full strength)
  const trendStrength = Math.min(1, Math.abs(distancePct) / 0.05);

  return { sma50, currentPrice, aboveSMA, trendDirection, trendStrength };
}

/* ── Volume Analysis ────────────────────────────────────────────────────── */

export interface VolumeResult {
  currentVolume: number;
  avgVolume: number;         // 20-period average volume
  volumeRatio: number;       // current / avg (>1.5 = surge, <0.5 = drought)
  volumeTrend: 'rising' | 'falling' | 'stable';
  isLiquid: boolean;         // volume ratio >= 0.5 — safe to trade
  isSurge: boolean;          // volume ratio >= 2.0 — breakout candidate
}

/**
 * Analyze volume to confirm trade signals and avoid low-liquidity traps.
 * Batch 7: Volume confirmation prevents entering positions on thin volume
 * where slippage and manipulation risk are highest.
 */
export function computeVolumeAnalysis(candles: Candle[], period = 20): VolumeResult | null {
  if (candles.length < period + 1) return null;

  const volumes = candles.map(c => c.volume);
  const currentVolume = volumes[volumes.length - 1]!;
  const recentVolumes = volumes.slice(-(period + 1), -1); // exclude current
  const avgVolume = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;

  if (avgVolume === 0) return null;

  const volumeRatio = currentVolume / avgVolume;

  // Volume trend: compare last 5 bars avg vs previous 5 bars avg
  let volumeTrend: 'rising' | 'falling' | 'stable' = 'stable';
  if (candles.length >= 10) {
    const recent5 = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const prev5 = volumes.slice(-10, -5).reduce((s, v) => s + v, 0) / 5;
    if (prev5 > 0) {
      const change = (recent5 - prev5) / prev5;
      if (change > 0.2) volumeTrend = 'rising';
      else if (change < -0.2) volumeTrend = 'falling';
    }
  }

  return {
    currentVolume,
    avgVolume,
    volumeRatio,
    volumeTrend,
    isLiquid: volumeRatio >= 0.5,
    isSurge: volumeRatio >= 2.0,
  };
}

/* ── Multi-Timeframe Trend ─────────────────────────────────────────────── */

export interface MultiTimeframeTrend {
  sma20: number;             // micro trend (entry timing)
  sma50: number;             // medium trend (existing)
  sma200: number;            // macro trend (regime)
  microTrend: 'up' | 'down' | 'flat';   // price vs 20-SMA
  mediumTrend: 'up' | 'down' | 'flat';  // price vs 50-SMA
  macroTrend: 'up' | 'down' | 'flat';   // price vs 200-SMA
  alignment: 'bullish' | 'bearish' | 'mixed';  // all 3 agree or not
  trendScore: number;        // -1.0 (strong bearish) to +1.0 (strong bullish)
}

/**
 * Multi-timeframe trend analysis using 20/50/200-period SMAs.
 * Batch 7: When all three SMAs agree on direction (alignment), the trend
 * is extremely strong. Mixed alignment = choppy market = stay out.
 * 20-SMA: micro timing (entry refinement)
 * 50-SMA: medium trend (existing filter)
 * 200-SMA: macro regime (bull/bear market)
 */
export function computeMultiTimeframeTrend(candles: Candle[]): MultiTimeframeTrend | null {
  if (candles.length < 200) return null;

  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1]!;

  const sma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const sma50 = closes.slice(-50).reduce((s, v) => s + v, 0) / 50;
  const sma200 = closes.slice(-200).reduce((s, v) => s + v, 0) / 200;

  const classify = (price: number, sma: number): 'up' | 'down' | 'flat' => {
    const pct = (price - sma) / sma;
    if (pct > 0.003) return 'up';
    if (pct < -0.003) return 'down';
    return 'flat';
  };

  const microTrend = classify(currentPrice, sma20);
  const mediumTrend = classify(currentPrice, sma50);
  const macroTrend = classify(currentPrice, sma200);

  // Alignment: all three agree = strong trend signal
  let alignment: 'bullish' | 'bearish' | 'mixed' = 'mixed';
  if (microTrend === 'up' && mediumTrend === 'up' && macroTrend === 'up') alignment = 'bullish';
  else if (microTrend === 'down' && mediumTrend === 'down' && macroTrend === 'down') alignment = 'bearish';

  // Trend score: weighted sum of distances from each SMA
  const microDist = (currentPrice - sma20) / sma20;
  const mediumDist = (currentPrice - sma50) / sma50;
  const macroDist = (currentPrice - sma200) / sma200;
  // Weights: macro matters most (50%), medium (30%), micro (20%)
  const rawScore = macroDist * 0.50 + mediumDist * 0.30 + microDist * 0.20;
  const trendScore = Math.max(-1, Math.min(1, rawScore / 0.05)); // normalize to [-1, 1]

  return {
    sma20, sma50, sma200,
    microTrend, mediumTrend, macroTrend,
    alignment, trendScore,
  };
}

/* ── Aggregate Technical Signal ────────────────────────────────────────── */

/* ── Correlation Matrix ─────────────────────────────────────────────────── */

export interface CorrelationResult {
  symbolA: string;
  symbolB: string;
  correlation: number;     // -1.0 to +1.0 (Pearson)
  isHighlyCorrelated: boolean;  // |correlation| >= 0.80
}

/**
 * Compute Pearson correlation between two price series.
 * Batch 8: Prevents concentrated risk by detecting when two assets move
 * together. If BTC and ETH are 0.92 correlated and Sven is long BTC,
 * going long ETH is effectively doubling the same bet.
 */
export function computeCorrelation(
  candlesA: Candle[],
  candlesB: Candle[],
  period = 50,
): number | null {
  const len = Math.min(candlesA.length, candlesB.length, period);
  if (len < 20) return null;

  const returnsA: number[] = [];
  const returnsB: number[] = [];
  for (let i = 1; i < len; i++) {
    returnsA.push((candlesA[candlesA.length - len + i]!.close - candlesA[candlesA.length - len + i - 1]!.close) / candlesA[candlesA.length - len + i - 1]!.close);
    returnsB.push((candlesB[candlesB.length - len + i]!.close - candlesB[candlesB.length - len + i - 1]!.close) / candlesB[candlesB.length - len + i - 1]!.close);
  }

  const n = returnsA.length;
  if (n < 10) return null;

  const meanA = returnsA.reduce((s, v) => s + v, 0) / n;
  const meanB = returnsB.reduce((s, v) => s + v, 0) / n;

  let covariance = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const dA = returnsA[i]! - meanA;
    const dB = returnsB[i]! - meanB;
    covariance += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denominator = Math.sqrt(varA * varB);
  if (denominator === 0) return null;

  return covariance / denominator;
}

/* ── ATR (Average True Range) — Volatility for Position Sizing ─────────── */

export interface ATRResult {
  atr: number;              // raw ATR value
  atrPct: number;           // ATR as % of current price
  isHighVolatility: boolean; // atrPct > 3%
  isLowVolatility: boolean;  // atrPct < 1%
}

/**
 * Compute ATR using Wilder's smoothing (14-period default).
 * Batch 8: Used for dynamic position sizing — volatile assets get smaller
 * positions. Also detects regime: high vol = smaller size, low vol = can size up.
 */
export function computeATR(candles: Candle[], period = 14): ATRResult | null {
  if (candles.length < period + 1) return null;

  let atr = 0;
  // Initial ATR: average of first `period` true ranges
  for (let i = 1; i <= period; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    atr += tr;
  }
  atr /= period;

  // Wilder's smoothing for remaining bars
  for (let i = period + 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
    atr = (atr * (period - 1) + tr) / period;
  }

  const currentPrice = candles[candles.length - 1]!.close;
  const atrPct = currentPrice > 0 ? atr / currentPrice : 0;

  return {
    atr,
    atrPct,
    isHighVolatility: atrPct > 0.03,
    isLowVolatility: atrPct < 0.01,
  };
}

/* ── Aggregate Technical Signal ────────────────────────────────────────── */

export interface TechnicalAnalysis {
  rsi: RSIResult | null;
  macd: MACDResult | null;
  bollinger: BollingerResult | null;
  trend: TrendResult | null;
  volume: VolumeResult | null;
  multiTrend: MultiTimeframeTrend | null;
  atr: ATRResult | null;
  direction: 'long' | 'short' | 'neutral';
  strength: number;
  confluence: number;    // 0–3: how many indicators agree
}

/**
 * Run all technical indicators and produce a consensus signal.
 * Confluence (agreement count) boosts the overall strength.
 */
export function computeTechnicalAnalysis(candles: Candle[]): TechnicalAnalysis {
  const rsi = computeRSI(candles);
  const macd = computeMACD(candles);
  const bollinger = computeBollinger(candles);
  const trend = computeTrendFilter(candles);
  const volume = computeVolumeAnalysis(candles);
  const multiTrend = computeMultiTimeframeTrend(candles);
  const atr = computeATR(candles);

  let longVotes = 0;
  let shortVotes = 0;
  let totalStrength = 0;
  let indicatorCount = 0;

  const indicators = [rsi, macd, bollinger].filter(Boolean) as Array<{ direction: string; strength: number }>;

  for (const ind of indicators) {
    indicatorCount++;
    totalStrength += ind.strength;
    if (ind.direction === 'long') longVotes++;
    else if (ind.direction === 'short') shortVotes++;
  }

  if (indicatorCount === 0) {
    return { rsi, macd, bollinger, trend, volume, multiTrend, atr, direction: 'neutral', strength: 0, confluence: 0 };
  }

  const avgStrength = totalStrength / indicatorCount;
  const confluence = Math.max(longVotes, shortVotes);

  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  if (longVotes > shortVotes) direction = 'long';
  else if (shortVotes > longVotes) direction = 'short';

  // Confluence bonus: 2/3 agree = 1.2x, 3/3 agree = 1.5x
  const confluenceMultiplier = confluence >= 3 ? 1.5 : confluence >= 2 ? 1.2 : 0.8;
  const strength = Math.min(1, avgStrength * confluenceMultiplier);

  return { rsi, macd, bollinger, trend, volume, multiTrend, atr, direction, strength, confluence };
}

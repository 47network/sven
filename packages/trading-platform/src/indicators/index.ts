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

/* ── Aggregate Technical Signal ────────────────────────────────────────── */

export interface TechnicalAnalysis {
  rsi: RSIResult | null;
  macd: MACDResult | null;
  bollinger: BollingerResult | null;
  trend: TrendResult | null;
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
    return { rsi, macd, bollinger, trend, direction: 'neutral', strength: 0, confluence: 0 };
  }

  const avgStrength = totalStrength / indicatorCount;
  const confluence = Math.max(longVotes, shortVotes);

  let direction: 'long' | 'short' | 'neutral' = 'neutral';
  if (longVotes > shortVotes) direction = 'long';
  else if (shortVotes > longVotes) direction = 'short';

  // Confluence bonus: 2/3 agree = 1.2x, 3/3 agree = 1.5x
  const confluenceMultiplier = confluence >= 3 ? 1.5 : confluence >= 2 ? 1.2 : 0.8;
  const strength = Math.min(1, avgStrength * confluenceMultiplier);

  return { rsi, macd, bollinger, trend, direction, strength, confluence };
}

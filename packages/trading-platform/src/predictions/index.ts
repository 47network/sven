// ---------------------------------------------------------------------------
// @sven/trading-platform — Predictions (Kronos, MiroFish, Ensemble)
// ---------------------------------------------------------------------------
// BSQ tokenization concept, multi-horizon prediction types, confidence
// scoring, model ensemble with weighted voting, accuracy tracking.
// ---------------------------------------------------------------------------

import type { Candle, Timeframe } from '../market-data/index.js';

/* ── Prediction Types ──────────────────────────────────────────────────── */

export type PredictionModel = 'kronos_v1' | 'mirofish' | 'ensemble' | 'technical' | 'news';
export type PredictionDirection = 'up' | 'down' | 'neutral';

export interface Prediction {
  id: string;
  createdAt: Date;
  model: PredictionModel;
  symbol: string;
  exchange: string;
  timeframe: Timeframe;
  horizonCandles: number;
  predictedOpen?: number;
  predictedHigh?: number;
  predictedLow?: number;
  predictedClose: number;
  predictedDirection: PredictionDirection;
  confidence: number;           // 0.0–1.0
  actualClose?: number;         // filled after horizon passes
  errorPct?: number;            // filled after evaluation
  metadata?: Record<string, unknown>;
}

/* ── BSQ Tokenization (Kronos Binary Spherical Quantization) ───────────── */

/**
 * Binary Spherical Quantization: project K-line (OHLCV candle) onto a
 * mathematical sphere as a binary token ({-1, +1} string).
 *
 * This normalizes across price scales — a penny stock candle and a
 * BTC candle produce comparable tokens because direction and relative
 * magnitude are encoded, not raw dollar amounts.
 */

export interface BSQToken {
  /** Binary representation: array of -1 or +1 */
  bits: number[];
  /** Dimensionality of the spherical projection */
  dimensions: number;
  /** Source candle metadata */
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
}

/**
 * Project a candle onto the unit sphere and quantize to binary.
 * Uses relative OHLCV ratios (scale-invariant):
 *   - open_to_close ratio
 *   - high_to_low ratio (range)
 *   - body_to_range ratio
 *   - upper_wick ratio
 *   - lower_wick ratio
 *   - volume_change (needs previous candle)
 * Each feature is projected onto a sphere and binarized by sign.
 */
export function tokenizeCandle(candle: Candle, prevCandle?: Candle, dimensions: number = 8): BSQToken {
  const range = candle.high - candle.low;
  const body = candle.close - candle.open;
  const midPoint = (candle.high + candle.low) / 2;

  // Scale-invariant features
  const features: number[] = [
    range > 0 ? body / range : 0,                                         // body ratio
    midPoint > 0 ? range / midPoint : 0,                                  // volatility ratio
    range > 0 ? (candle.high - Math.max(candle.open, candle.close)) / range : 0, // upper wick
    range > 0 ? (Math.min(candle.open, candle.close) - candle.low) / range : 0,  // lower wick
    candle.open > 0 ? (candle.close - candle.open) / candle.open : 0,     // return
    prevCandle && prevCandle.volume > 0 ? (candle.volume - prevCandle.volume) / prevCandle.volume : 0, // vol change
    prevCandle ? (candle.close - prevCandle.close) / (prevCandle.close || 1) : 0, // momentum
    prevCandle && prevCandle.high !== prevCandle.low
      ? (range - (prevCandle.high - prevCandle.low)) / (prevCandle.high - prevCandle.low)
      : 0, // range expansion
  ];

  // Pad or trim to target dimensions
  while (features.length < dimensions) features.push(0);
  const trimmed = features.slice(0, dimensions);

  // Spherical projection: normalize to unit sphere, then binarize
  const magnitude = Math.sqrt(trimmed.reduce((s, f) => s + f * f, 0)) || 1;
  const projected = trimmed.map((f) => f / magnitude);
  const bits = projected.map((f) => (f >= 0 ? 1 : -1));

  return {
    bits,
    dimensions,
    symbol: candle.symbol,
    timeframe: candle.timeframe,
    timestamp: candle.time,
  };
}

export function tokenSequenceToString(tokens: BSQToken[]): string {
  return tokens.map((t) => t.bits.map((b) => (b === 1 ? '+' : '-')).join('')).join(' ');
}

/* ── Multi-Horizon Prediction ──────────────────────────────────────────── */

export interface MultiHorizonPrediction {
  symbol: string;
  model: PredictionModel;
  generatedAt: Date;
  horizons: {
    timeframe: Timeframe;
    horizonCandles: number;
    predictedDirection: PredictionDirection;
    predictedClose: number;
    confidence: number;
  }[];
}

export function generateMultiHorizon(
  symbol: string,
  model: PredictionModel,
  currentPrice: number,
  directionScores: { timeframe: Timeframe; horizonCandles: number; upProb: number }[],
): MultiHorizonPrediction {
  return {
    symbol,
    model,
    generatedAt: new Date(),
    horizons: directionScores.map((ds) => {
      const direction: PredictionDirection = ds.upProb > 0.55 ? 'up' : ds.upProb < 0.45 ? 'down' : 'neutral';
      const magnitude = Math.abs(ds.upProb - 0.5) * 2; // 0-1 scale of conviction
      const predictedMove = direction === 'up' ? magnitude * 0.05 : direction === 'down' ? -magnitude * 0.05 : 0;
      return {
        timeframe: ds.timeframe,
        horizonCandles: ds.horizonCandles,
        predictedDirection: direction,
        predictedClose: currentPrice * (1 + predictedMove),
        confidence: Math.abs(ds.upProb - 0.5) * 2,
      };
    }),
  };
}

/* ── MiroFish Simulation Types ─────────────────────────────────────────── */

export type AgentStrategyType = 'momentum' | 'mean_reversion' | 'sentiment' | 'fundamental' | 'technical' | 'contrarian' | 'random_walk';

export interface SimulationAgent {
  id: string;
  strategy: AgentStrategyType;
  capital: number;
  position: number;         // positive = long, negative = short, 0 = flat
  pnl: number;
  confidence: number;
  survivalScore: number;    // evolutionary fitness
}

export interface SimulationResult {
  symbol: string;
  agentCount: number;
  timesteps: number;
  consensusDirection: PredictionDirection;
  consensusStrength: number;
  bullishAgents: number;
  bearishAgents: number;
  neutralAgents: number;
  simulatedPrice: number;
  realPrice: number;
  topStrategies: { strategy: AgentStrategyType; avgPnl: number; count: number }[];
  completedAt: Date;
}

export function extractConsensus(agents: SimulationAgent[]): { direction: PredictionDirection; strength: number } {
  const total = agents.length;
  if (total === 0) return { direction: 'neutral', strength: 0 };

  let longCount = 0;
  let shortCount = 0;
  let longWeight = 0;
  let shortWeight = 0;

  for (const agent of agents) {
    if (agent.position > 0) {
      longCount++;
      longWeight += agent.survivalScore;
    } else if (agent.position < 0) {
      shortCount++;
      shortWeight += agent.survivalScore;
    }
  }

  const totalWeight = longWeight + shortWeight || 1;
  const longPct = longWeight / totalWeight;
  const shortPct = shortWeight / totalWeight;

  if (longPct > 0.6) return { direction: 'up', strength: longPct };
  if (shortPct > 0.6) return { direction: 'down', strength: shortPct };
  return { direction: 'neutral', strength: Math.max(longPct, shortPct) };
}

/* ── Model Ensemble ────────────────────────────────────────────────────── */

export interface EnsembleWeight {
  model: PredictionModel;
  weight: number;
  recentAccuracy: number;
}

export const DEFAULT_ENSEMBLE_WEIGHTS: EnsembleWeight[] = [
  { model: 'kronos_v1', weight: 0.35, recentAccuracy: 0 },
  { model: 'mirofish', weight: 0.30, recentAccuracy: 0 },
  { model: 'technical', weight: 0.20, recentAccuracy: 0 },
  { model: 'news', weight: 0.15, recentAccuracy: 0 },
];

export function ensembleVote(
  predictions: Prediction[],
  weights: EnsembleWeight[] = DEFAULT_ENSEMBLE_WEIGHTS,
): { direction: PredictionDirection; confidence: number; breakdown: Record<string, number> } {
  const weightMap = new Map(weights.map((w) => [w.model, w.weight]));
  let upScore = 0;
  let downScore = 0;
  let totalWeight = 0;
  const breakdown: Record<string, number> = {};

  for (const pred of predictions) {
    const w = weightMap.get(pred.model) ?? 0.1;
    totalWeight += w;
    const contribution = pred.confidence * w;

    if (pred.predictedDirection === 'up') {
      upScore += contribution;
      breakdown[pred.model] = contribution;
    } else if (pred.predictedDirection === 'down') {
      downScore += contribution;
      breakdown[pred.model] = -contribution;
    } else {
      breakdown[pred.model] = 0;
    }
  }

  if (totalWeight === 0) return { direction: 'neutral', confidence: 0, breakdown };

  const normUp = upScore / totalWeight;
  const normDown = downScore / totalWeight;

  const direction: PredictionDirection = normUp > normDown ? 'up' : normDown > normUp ? 'down' : 'neutral';
  const confidence = Math.abs(normUp - normDown);

  return { direction, confidence, breakdown };
}

/* ── Accuracy Tracking ─────────────────────────────────────────────────── */

export interface AccuracyRecord {
  model: PredictionModel;
  symbol: string;
  timeframe: Timeframe;
  totalPredictions: number;
  correctDirection: number;
  directionAccuracy: number;
  meanAbsoluteError: number;
  rootMeanSquaredError: number;
  sharpeIfTraded: number;
}

export function evaluatePrediction(predicted: Prediction, actualClose: number): {
  directionCorrect: boolean;
  errorPct: number;
  absError: number;
} {
  const actualDirection: PredictionDirection = actualClose > predicted.predictedClose ? 'up' : actualClose < predicted.predictedClose ? 'down' : 'neutral';

  // Direction is correct if predicted up and actual went up vs predicted close, etc.
  const directionCorrect = predicted.predictedDirection === 'up'
    ? actualClose > (predicted.predictedOpen ?? predicted.predictedClose)
    : predicted.predictedDirection === 'down'
      ? actualClose < (predicted.predictedOpen ?? predicted.predictedClose)
      : Math.abs(actualClose - predicted.predictedClose) / predicted.predictedClose < 0.005;

  const errorPct = predicted.predictedClose > 0
    ? ((actualClose - predicted.predictedClose) / predicted.predictedClose) * 100
    : 0;

  return {
    directionCorrect,
    errorPct,
    absError: Math.abs(actualClose - predicted.predictedClose),
  };
}

export function computeAccuracy(
  evaluations: { directionCorrect: boolean; errorPct: number; absError: number }[],
  model: PredictionModel,
  symbol: string,
  timeframe: Timeframe,
): AccuracyRecord {
  const n = evaluations.length;
  if (n === 0) {
    return {
      model, symbol, timeframe,
      totalPredictions: 0, correctDirection: 0, directionAccuracy: 0,
      meanAbsoluteError: 0, rootMeanSquaredError: 0, sharpeIfTraded: 0,
    };
  }

  const correct = evaluations.filter((e) => e.directionCorrect).length;
  const mae = evaluations.reduce((s, e) => s + e.absError, 0) / n;
  const mse = evaluations.reduce((s, e) => s + e.absError ** 2, 0) / n;
  const rmse = Math.sqrt(mse);

  // Simplified Sharpe: assume +1 return if direction correct, -1 if wrong
  const returns = evaluations.map((e) => (e.directionCorrect ? 1 : -1));
  const meanRet = returns.reduce((a, b) => a + b, 0) / n;
  const stdRet = Math.sqrt(returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / n) || 1;
  const sharpe = (meanRet / stdRet) * Math.sqrt(252);

  return {
    model, symbol, timeframe,
    totalPredictions: n,
    correctDirection: correct,
    directionAccuracy: correct / n,
    meanAbsoluteError: mae,
    rootMeanSquaredError: rmse,
    sharpeIfTraded: sharpe,
  };
}

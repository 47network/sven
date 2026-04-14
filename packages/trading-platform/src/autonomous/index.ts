// ---------------------------------------------------------------------------
// @sven/trading-platform — Autonomous Trading Engine
// ---------------------------------------------------------------------------
// Sven's self-directed trading brain. Manages the full loop:
//   1. Ingest real-time market data (candles, ticks)
//   2. Run Kronos BSQ tokenization + multi-horizon prediction
//   3. Run MiroFish agent-based simulation for consensus
//   4. Analyze news & geopolitical events for impact signals
//   5. Aggregate all signals with weighted voting
//   6. Run pre-trade risk checks + position sizing
//   7. Execute orders via OMS (paper → internal → live)
//   8. Track portfolio, performance, and learning metrics
//   9. Emit SSE events to trading-ui in real-time
//  10. Log every decision for Sven's self-improvement loop
// ---------------------------------------------------------------------------

import {
  type Signal,
  type SignalDirection,
  type StrategyContext,
  type TradingLoopConfig,
  type TradeDecision,
  type DecisionType,
  StrategyRegistry,
  aggregateSignals,
  buildDecision,
  DEFAULT_LOOP_CONFIG,
  DEFAULT_SOURCE_WEIGHTS,
} from '../engine/index.js';

import {
  type Candle,
  type Timeframe,
} from '../market-data/index.js';

import {
  runAllRiskChecks,
  riskChecksPassed,
  fixedFractionalSize,
  kellyCriterionSize,
  volatilityBasedSize,
  type RiskCheckResult,
} from '../risk/index.js';

import {
  createOrder,
  applyTransition,
  computePortfolioState,
  computeTradePerformance,
  createTokenAccount,
  freezeFunds,
  releaseFunds,
  TOKEN_CONFIG,
  type Order,
  type Position,
  type PortfolioState,
  type TokenAccount,
  type TradePerformance,
} from '../oms/index.js';

import {
  tokenizeCandle,
  generateMultiHorizon,
  ensembleVote,
  extractConsensus,
  type BSQToken,
  type Prediction,
  type MultiHorizonPrediction,
  type SimulationAgent,
  type SimulationResult,
  type AgentStrategyType,
} from '../predictions/index.js';

import {
  classifyImpact,
  scoreSentiment,
  type NewsEvent,
  type ImpactLevel,
} from '../news/index.js';

import {
  computeTechnicalAnalysis,
  type TechnicalAnalysis,
} from '../indicators/index.js';

/* ── Sven State Machine ────────────────────────────────────────────────── */

export type SvenTradingState =
  | 'idle'
  | 'scanning'       // watching market, collecting data
  | 'analyzing'      // running predictions + simulations
  | 'deciding'       // aggregating signals, checking risk
  | 'executing'      // placing orders
  | 'monitoring'     // watching open positions
  | 'trading'        // autonomous loop running
  | 'learning'       // reviewing performance, adjusting weights
  | 'paused'         // manually paused or circuit breaker tripped
  | 'error';

export interface SvenTradingStatus {
  state: SvenTradingState;
  activeSymbol: string | null;
  openPositions: number;
  pendingOrders: number;
  todayPnl: number;
  todayTrades: number;
  uptime: number;
  lastLoopAt: string | null;
  lastDecision: TradeDecision | null;
  circuitBreaker: CircuitBreakerState;
  mode: 'paper' | 'internal' | 'live';
}

/* ── Circuit Breaker ───────────────────────────────────────────────────── */

export interface CircuitBreakerState {
  tripped: boolean;
  reason: string | null;
  trippedAt: Date | null;
  dailyLossPct: number;
  dailyLossLimit: number;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerState = {
  tripped: false,
  reason: null,
  trippedAt: null,
  dailyLossPct: 0,
  dailyLossLimit: 0.05,          // 5% daily loss limit
  consecutiveLosses: 0,
  maxConsecutiveLosses: 5,
  maxDrawdownPct: 0.15,          // 15% max drawdown
  currentDrawdownPct: 0,
};

export function checkCircuitBreaker(cb: CircuitBreakerState): CircuitBreakerState {
  if (cb.tripped) return cb;

  if (cb.dailyLossPct >= cb.dailyLossLimit) {
    return { ...cb, tripped: true, reason: `Daily loss limit hit: ${(cb.dailyLossPct * 100).toFixed(1)}%`, trippedAt: new Date() };
  }
  if (cb.consecutiveLosses >= cb.maxConsecutiveLosses) {
    return { ...cb, tripped: true, reason: `${cb.consecutiveLosses} consecutive losses`, trippedAt: new Date() };
  }
  if (cb.currentDrawdownPct >= cb.maxDrawdownPct) {
    return { ...cb, tripped: true, reason: `Max drawdown hit: ${(cb.currentDrawdownPct * 100).toFixed(1)}%`, trippedAt: new Date() };
  }
  return cb;
}

export function resetCircuitBreaker(): CircuitBreakerState {
  return { ...DEFAULT_CIRCUIT_BREAKER };
}

/* ── SSE Event Types ───────────────────────────────────────────────────── */

export type TradingEventType =
  | 'state_change'       // Sven changed state
  | 'signal_generated'   // new signal from any source
  | 'decision_made'      // Sven made a trade decision
  | 'order_placed'       // order submitted
  | 'order_filled'       // order executed
  | 'position_opened'    // new position
  | 'position_closed'    // position closed with P&L
  | 'risk_alert'         // risk check warning
  | 'circuit_breaker'    // circuit breaker tripped/reset
  | 'prediction_ready'   // Kronos/MiroFish prediction completed
  | 'news_impact'        // high-impact news detected
  | 'portfolio_update'   // portfolio state changed
  | 'learning_update'    // weight/strategy adjustment
  | 'market_data'        // price update for active symbol
  | 'activity'           // general activity log
  | 'broker_order'       // broker order submitted
  | 'backtest_complete'  // backtest run finished
  | 'alert_triggered'    // trading alert fired
  | 'alert_created'      // new alert configured
  | 'loop_started'       // autonomous loop started
  | 'loop_stopped'       // autonomous loop stopped
  | 'loop_tick'          // autonomous loop iteration completed
  | 'loop_skipped'       // autonomous loop iteration skipped (CB open)
  | 'loop_error'         // autonomous loop iteration error
  | 'trade_executed'     // Sven auto-executed a trade
  | 'trend_scout'       // news-driven symbol discovery event
  | 'signal_override'    // signal source override (e.g. paper mode)
  | 'sven_message';      // proactive message from Sven

export interface TradingEvent {
  id: string;
  type: TradingEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export function createTradingEvent(type: TradingEventType, data: Record<string, unknown>): TradingEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date(),
    data,
  };
}

/* ── Learning & Self-Improvement ───────────────────────────────────────── */

export interface LearningMetrics {
  /** Source weight history — Sven adjusts these over time */
  sourceWeights: Record<string, number>;
  /** Model accuracy tracking */
  modelAccuracy: Record<string, { correct: number; total: number; accuracy: number }>;
  /** Strategy performance ranking */
  strategyRankings: { strategyId: string; winRate: number; profitFactor: number; trades: number }[];
  /** Patterns Sven has learned */
  learnedPatterns: LearnedPattern[];
  /** Last time weights were adjusted */
  lastWeightAdjustment: Date | null;
  /** Number of learning iterations completed */
  learningIterations: number;
}

export interface LearnedPattern {
  id: string;
  description: string;
  symbol: string;
  timeframe: Timeframe;
  bsqPattern: string;           // BSQ token sequence that preceded a move
  outcomeDirection: SignalDirection;
  confidence: number;
  occurrences: number;
  discoveredAt: Date;
}

export const DEFAULT_LEARNING_METRICS: LearningMetrics = {
  sourceWeights: {
    kronos: 0.30,
    mirofish: 0.25,
    'news-intelligence': 0.15,
    technical: 0.20,
    ensemble: 0.10,
  },
  modelAccuracy: {
    kronos_v1: { correct: 0, total: 0, accuracy: 0 },
    mirofish: { correct: 0, total: 0, accuracy: 0 },
    technical: { correct: 0, total: 0, accuracy: 0 },
    news: { correct: 0, total: 0, accuracy: 0 },
  },
  strategyRankings: [],
  learnedPatterns: [],
  lastWeightAdjustment: null,
  learningIterations: 0,
};

/**
 * Adjust source weights based on recent prediction accuracy.
 * Models that predicted correctly get weight increases; poor performers get reduced.
 * Weights are normalized to sum to 1.0.
 */
export function adjustWeights(
  metrics: LearningMetrics,
  minSamples: number = 20,
): LearningMetrics {
  const entries = Object.entries(metrics.modelAccuracy);
  const eligible = entries.filter(([, m]) => m.total >= minSamples);

  if (eligible.length < 2) return metrics;

  const newWeights = { ...metrics.sourceWeights };

  // Map model names to source names
  const modelToSource: Record<string, string> = {
    kronos_v1: 'kronos',
    mirofish: 'mirofish',
    technical: 'technical',
    news: 'news-intelligence',
  };

  // Compute performance-based weights
  const totalAccuracy = eligible.reduce((sum, [, m]) => sum + m.accuracy, 0);
  if (totalAccuracy > 0) {
    for (const [model, metrics_entry] of eligible) {
      const sourceKey = modelToSource[model] ?? model;
      if (sourceKey in newWeights) {
        const perfWeight = metrics_entry.accuracy / totalAccuracy;
        // Blend: 70% performance-based, 30% prior weight (stability)
        newWeights[sourceKey] = 0.7 * perfWeight + 0.3 * (newWeights[sourceKey] ?? 0.1);
      }
    }
  }

  // Normalize
  const total = Object.values(newWeights).reduce((s, w) => s + w, 0);
  if (total > 0) {
    for (const key of Object.keys(newWeights)) {
      newWeights[key] = newWeights[key]! / total;
    }
  }

  return {
    ...metrics,
    sourceWeights: newWeights,
    lastWeightAdjustment: new Date(),
    learningIterations: metrics.learningIterations + 1,
  };
}

/**
 * Record a prediction outcome and update accuracy metrics.
 */
export function recordPredictionOutcome(
  metrics: LearningMetrics,
  model: string,
  wasCorrect: boolean,
): LearningMetrics {
  const current = metrics.modelAccuracy[model] ?? { correct: 0, total: 0, accuracy: 0 };
  const total = current.total + 1;
  const correct = current.correct + (wasCorrect ? 1 : 0);

  return {
    ...metrics,
    modelAccuracy: {
      ...metrics.modelAccuracy,
      [model]: { correct, total, accuracy: total > 0 ? correct / total : 0 },
    },
  };
}

/* ── MiroFish Agent Simulation Runner ──────────────────────────────────── */

const AGENT_STRATEGIES: AgentStrategyType[] = [
  'momentum', 'mean_reversion', 'sentiment', 'fundamental',
  'technical', 'contrarian', 'random_walk',
];

/**
 * Spawn a population of simulated trading agents, each with a different
 * strategy. They observe the same candle history and vote on direction.
 * This is the MiroFish approach: multi-agent simulation for consensus.
 */
export function runMiroFishSimulation(
  symbol: string,
  candles: Candle[],
  agentCount: number = 1000,
  timesteps: number = 100,
): SimulationResult {
  if (candles.length < 20) {
    return {
      symbol,
      agentCount: 0,
      timesteps: 0,
      consensusDirection: 'neutral',
      consensusStrength: 0,
      bullishAgents: 0,
      bearishAgents: 0,
      neutralAgents: 0,
      simulatedPrice: candles.at(-1)?.close ?? 0,
      realPrice: candles.at(-1)?.close ?? 0,
      topStrategies: [],
      completedAt: new Date(),
    };
  }

  // Create agents with diversified strategies
  const agents: SimulationAgent[] = [];
  for (let i = 0; i < agentCount; i++) {
    const strategy = AGENT_STRATEGIES[i % AGENT_STRATEGIES.length]!;
    agents.push({
      id: `agent-${i}`,
      strategy,
      capital: 10000,
      position: 0,
      pnl: 0,
      confidence: 0.5,
      survivalScore: 1.0,
    });
  }

  // Simulate: each agent trades based on last N candles
  const recentCandles = candles.slice(-Math.min(timesteps, candles.length));

  for (let t = 5; t < recentCandles.length; t++) {
    const current = recentCandles[t]!;
    const lookback = recentCandles.slice(Math.max(0, t - 20), t);
    const avgClose = lookback.reduce((s, c) => s + c.close, 0) / lookback.length;
    const returns = lookback.slice(1).map((c, i) => (c.close - lookback[i]!.close) / lookback[i]!.close);
    const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
    const volatility = returns.length > 1
      ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length)
      : 0.01;

    for (const agent of agents) {
      let signal = 0; // positive = bullish, negative = bearish

      switch (agent.strategy) {
        case 'momentum':
          // Only signal when trend is meaningful (beyond noise threshold)
          signal = avgReturn > volatility * 0.5 ? 1 : avgReturn < -volatility * 0.5 ? -1 : 0;
          break;
        case 'mean_reversion':
          signal = current.close < avgClose * 0.98 ? 1 : current.close > avgClose * 1.02 ? -1 : 0;
          break;
        case 'sentiment':
          // Volume surge = bullish, volume drought = bearish, normal = neutral
          {
            const avgVol = lookback.reduce((s, c) => s + c.volume, 0) / lookback.length;
            signal = current.volume > avgVol * 1.5 ? 1 : current.volume < avgVol * 0.5 ? -1 : 0;
          }
          break;
        case 'fundamental':
          // Only signal when significantly away from avg (2% bands)
          signal = current.close < avgClose * 0.98 ? 1 : current.close > avgClose * 1.02 ? -1 : 0;
          break;
        case 'technical':
          // RSI-like: oversold/overbought
          signal = avgReturn < -volatility ? 1 : avgReturn > volatility ? -1 : 0;
          break;
        case 'contrarian':
          // Only go contrarian on strong trends (beyond 1.5x volatility)
          signal = avgReturn > volatility * 1.5 ? -1 : avgReturn < -volatility * 1.5 ? 1 : 0;
          break;
        case 'random_walk':
          signal = Math.random() > 0.5 ? 1 : -1;
          break;
      }

      // Apply signal to position
      const prevPosition = agent.position;
      agent.position = signal;

      // Calculate P&L from position change
      if (prevPosition !== 0 && t > 5) {
        const priceChange = (current.close - recentCandles[t - 1]!.close) / recentCandles[t - 1]!.close;
        agent.pnl += prevPosition * priceChange * agent.capital;
      }

      // Update survival score (agents that lose money get penalized)
      agent.survivalScore = Math.max(0.01, 1 + agent.pnl / agent.capital);
      agent.confidence = Math.min(1, Math.max(0, 0.5 + agent.pnl / (agent.capital * 2)));
    }
  }

  // Extract consensus
  const consensus = extractConsensus(agents);

  // Compute strategy rankings
  const strategyPnl = new Map<AgentStrategyType, { totalPnl: number; count: number }>();
  for (const agent of agents) {
    const entry = strategyPnl.get(agent.strategy) ?? { totalPnl: 0, count: 0 };
    entry.totalPnl += agent.pnl;
    entry.count++;
    strategyPnl.set(agent.strategy, entry);
  }

  const topStrategies = [...strategyPnl.entries()]
    .map(([strategy, { totalPnl, count }]) => ({
      strategy,
      avgPnl: totalPnl / count,
      count,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  const bullish = agents.filter((a) => a.position > 0).length;
  const bearish = agents.filter((a) => a.position < 0).length;

  return {
    symbol,
    agentCount,
    timesteps: recentCandles.length,
    consensusDirection: consensus.direction,
    consensusStrength: consensus.strength,
    bullishAgents: bullish,
    bearishAgents: bearish,
    neutralAgents: agentCount - bullish - bearish,
    simulatedPrice: candles.at(-1)?.close ?? 0,
    realPrice: candles.at(-1)?.close ?? 0,
    topStrategies,
    completedAt: new Date(),
  };
}

/* ── Kronos Pipeline ───────────────────────────────────────────────────── */

/**
 * Run the full Kronos prediction pipeline:
 *   1. Tokenize candle history using BSQ
 *   2. Analyze token patterns for directional bias
 *   3. Generate multi-horizon predictions
 */
export function runKronosPipeline(
  symbol: string,
  candles: Candle[],
  currentPrice: number,
): { tokens: BSQToken[]; prediction: MultiHorizonPrediction; patterns: string[] } {
  if (candles.length < 10) {
    return {
      tokens: [],
      prediction: {
        symbol,
        model: 'kronos_v1',
        generatedAt: new Date(),
        horizons: [],
      },
      patterns: [],
    };
  }

  // Step 1: Tokenize all candles
  const tokens: BSQToken[] = [];
  for (let i = 0; i < candles.length; i++) {
    tokens.push(tokenizeCandle(candles[i]!, i > 0 ? candles[i - 1] : undefined));
  }

  // Step 2: Analyze recent token patterns for directional bias
  const recentTokens = tokens.slice(-20);
  let bullishPatterns = 0;
  let bearishPatterns = 0;

  for (const token of recentTokens) {
    // Body ratio positive = bullish candle, first bit encodes this
    if (token.bits[0] === 1) bullishPatterns++;
    else bearishPatterns++;

    // Momentum bit (7th feature) positive = bullish momentum
    if (token.bits.length > 6 && token.bits[6] === 1) bullishPatterns++;
    else bearishPatterns++;
  }

  const totalSignals = bullishPatterns + bearishPatterns;
  const bullishProbability = totalSignals > 0 ? bullishPatterns / totalSignals : 0.5;

  // Step 3: Generate multi-horizon predictions
  const horizons: { timeframe: Timeframe; horizonCandles: number; upProb: number }[] = [
    { timeframe: '1h', horizonCandles: 1, upProb: bullishProbability },
    { timeframe: '4h', horizonCandles: 4, upProb: bullishProbability * 0.95 + 0.025 }, // slight regression to mean
    { timeframe: '1d', horizonCandles: 24, upProb: bullishProbability * 0.85 + 0.075 },
    { timeframe: '1w', horizonCandles: 168, upProb: bullishProbability * 0.70 + 0.15 },
  ];

  const prediction = generateMultiHorizon(symbol, 'kronos_v1', currentPrice, horizons);

  // Extract discovered patterns (for learning)
  const patternStrings: string[] = [];
  if (recentTokens.length >= 5) {
    const lastFive = recentTokens.slice(-5);
    const pattern = lastFive.map((t) => t.bits.map((b) => (b === 1 ? '+' : '-')).join('')).join('|');
    patternStrings.push(pattern);
  }

  return { tokens, prediction, patterns: patternStrings };
}

/* ── News-to-Signal Pipeline ───────────────────────────────────────────── */

export interface NewsSignal extends Signal {
  newsEventId: string;
  impactLevel: ImpactLevel;
  headline: string;
}

/**
 * Convert a news event into a trading signal.
 * High-impact news (level 3+) generates immediate signals.
 * Wars, crises, and geopolitical events trigger defensive positioning.
 */
export function newsToSignal(event: NewsEvent): NewsSignal | null {
  // Only generate signals for impact level 2+
  if (event.impactLevel < 2) return null;

  let direction: SignalDirection = 'close';
  let strength = 0;

  // Impact level determines signal strength
  const impactStrengthMap: Record<number, number> = {
    2: 0.40,
    3: 0.60,
    4: 0.80,
    5: 0.95,
  };
  strength = impactStrengthMap[event.impactLevel] ?? 0.30;

  // Sentiment determines direction
  if (event.sentiment > 0.2) {
    direction = 'long';
  } else if (event.sentiment < -0.2) {
    direction = 'short';
  } else {
    // Neutral sentiment with high impact → defensive (close positions)
    direction = 'close';
    strength *= 0.5;
  }

  // Wars, crises, and extreme events → defensive
  if (event.impactLevel >= 4 && event.impactCategory === 'geopolitical') {
    direction = 'short'; // risk-off
    strength = Math.max(strength, 0.85);
  }

  // Natural disasters → short-term bearish
  if (event.impactCategory === 'natural_disaster' && event.impactLevel >= 3) {
    direction = 'short';
    strength = Math.max(strength, 0.70);
  }

  return {
    id: `news-sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    symbol: event.symbols[0] ?? 'MARKET',
    direction,
    strength,
    source: 'news-intelligence',
    createdAt: new Date(),
    metadata: {
      impactLevel: event.impactLevel,
      impactCategory: event.impactCategory,
      sentiment: event.sentiment,
      headline: event.headline,
      symbols: event.symbols,
    },
    newsEventId: event.id,
    impactLevel: event.impactLevel,
    headline: event.headline,
  };
}

/* ── Autonomous Decision Engine ────────────────────────────────────────── */

export interface AutonomousDecisionInput {
  symbol: string;
  candles: Candle[];
  currentPrice: number;
  portfolio: PortfolioState;
  config: TradingLoopConfig;
  learningMetrics: LearningMetrics;
  newsEvents: NewsEvent[];
  circuitBreaker: CircuitBreakerState;
  paperTradeMode?: boolean;
}

export interface AutonomousDecisionOutput {
  decision: TradeDecision;
  kronosPrediction: MultiHorizonPrediction | null;
  mirofishResult: SimulationResult | null;
  newsSignals: NewsSignal[];
  technicalAnalysis: TechnicalAnalysis | null;
  aggregatedSignal: Signal | null;
  riskChecks: RiskCheckResult[];
  order: Order | null;
  events: TradingEvent[];
  updatedLearningMetrics: LearningMetrics;
  updatedCircuitBreaker: CircuitBreakerState;
}

/**
 * The core autonomous decision function. Sven calls this every loop iteration.
 * It runs the full pipeline: predict → simulate → analyze news → aggregate →
 * risk check → decide → execute.
 */
export function makeAutonomousDecision(input: AutonomousDecisionInput): AutonomousDecisionOutput {
  const events: TradingEvent[] = [];
  let metrics = { ...input.learningMetrics };
  let cb = { ...input.circuitBreaker };

  // Check circuit breaker first
  cb = checkCircuitBreaker(cb);
  if (cb.tripped) {
    events.push(createTradingEvent('circuit_breaker', {
      action: 'tripped',
      reason: cb.reason,
      symbol: input.symbol,
    }));

    return {
      decision: buildDecision('skip', input.symbol, [], {}, `Circuit breaker tripped: ${cb.reason}`),
      kronosPrediction: null,
      mirofishResult: null,
      newsSignals: [],
      technicalAnalysis: null,
      aggregatedSignal: null,
      riskChecks: [],
      order: null,
      events,
      updatedLearningMetrics: metrics,
      updatedCircuitBreaker: cb,
    };
  }

  const allSignals: Signal[] = [];

  // ── 1. Run Kronos BSQ Pipeline ────────────────────────────────────
  events.push(createTradingEvent('state_change', { state: 'analyzing', phase: 'kronos', symbol: input.symbol }));

  const kronos = runKronosPipeline(input.symbol, input.candles, input.currentPrice);
  let kronosPrediction: MultiHorizonPrediction | null = null;

  if (kronos.prediction.horizons.length > 0) {
    kronosPrediction = kronos.prediction;
    const shortHorizon = kronos.prediction.horizons[0]!;

    const kronosSignal: Signal = {
      id: `kronos-${Date.now()}`,
      symbol: input.symbol,
      direction: shortHorizon.predictedDirection === 'up' ? 'long' : shortHorizon.predictedDirection === 'down' ? 'short' : 'close',
      strength: shortHorizon.confidence,
      source: 'kronos',
      createdAt: new Date(),
      metadata: { horizons: kronos.prediction.horizons, patterns: kronos.patterns },
    };
    allSignals.push(kronosSignal);

    events.push(createTradingEvent('prediction_ready', {
      model: 'kronos_v1',
      symbol: input.symbol,
      direction: shortHorizon.predictedDirection,
      confidence: shortHorizon.confidence,
      horizons: kronos.prediction.horizons.length,
    }));
  }

  // ── 2. Run MiroFish Simulation ────────────────────────────────────
  events.push(createTradingEvent('state_change', { state: 'analyzing', phase: 'mirofish', symbol: input.symbol }));

  const mirofish = runMiroFishSimulation(input.symbol, input.candles, 500, 50);
  let mirofishResult: SimulationResult | null = null;

  if (mirofish.agentCount > 0) {
    mirofishResult = mirofish;

    const mirofishSignal: Signal = {
      id: `mirofish-${Date.now()}`,
      symbol: input.symbol,
      direction: mirofish.consensusDirection === 'up' ? 'long' : mirofish.consensusDirection === 'down' ? 'short' : 'close',
      strength: mirofish.consensusStrength,
      source: 'mirofish',
      createdAt: new Date(),
      metadata: {
        agents: mirofish.agentCount,
        bullish: mirofish.bullishAgents,
        bearish: mirofish.bearishAgents,
        topStrategies: mirofish.topStrategies.slice(0, 3),
      },
    };
    allSignals.push(mirofishSignal);

    events.push(createTradingEvent('prediction_ready', {
      model: 'mirofish',
      symbol: input.symbol,
      direction: mirofish.consensusDirection,
      strength: mirofish.consensusStrength,
      agents: mirofish.agentCount,
      bullish: mirofish.bullishAgents,
      bearish: mirofish.bearishAgents,
    }));
  }

  // ── 3. Analyze News Events ────────────────────────────────────────
  const newsSignals: NewsSignal[] = [];
  for (const event of input.newsEvents) {
    const sig = newsToSignal(event);
    if (sig && (sig.symbol === input.symbol || sig.symbol === 'MARKET')) {
      newsSignals.push(sig);
      allSignals.push(sig);

      events.push(createTradingEvent('news_impact', {
        headline: event.headline,
        impactLevel: event.impactLevel,
        sentiment: event.sentiment,
        direction: sig.direction,
        strength: sig.strength,
      }));
    }
  }

  // ── 3b. Technical Analysis (RSI, MACD, Bollinger Bands) ──────────
  events.push(createTradingEvent('state_change', { state: 'analyzing', phase: 'technical', symbol: input.symbol }));

  const ta = computeTechnicalAnalysis(input.candles);
  if (ta.direction !== 'neutral' && ta.strength > 0) {
    const taSignal: Signal = {
      id: `technical-${Date.now()}`,
      symbol: input.symbol,
      direction: ta.direction === 'long' ? 'long' : 'short',
      strength: ta.strength,
      source: 'technical',
      createdAt: new Date(),
      metadata: {
        rsi: ta.rsi?.value ?? null,
        rsiDirection: ta.rsi?.direction ?? null,
        macdHistogram: ta.macd?.histogram ?? null,
        macdCrossover: ta.macd?.crossover ?? null,
        bollingerPercentB: ta.bollinger?.percentB ?? null,
        bollingerSqueeze: ta.bollinger?.squeeze ?? null,
        confluence: ta.confluence,
      },
    };
    allSignals.push(taSignal);

    events.push(createTradingEvent('prediction_ready', {
      model: 'technical_analysis',
      symbol: input.symbol,
      direction: ta.direction,
      strength: ta.strength,
      confluence: ta.confluence,
      rsi: ta.rsi?.value ?? null,
      macdCrossover: ta.macd?.crossover ?? null,
      bollingerPercentB: ta.bollinger?.percentB ?? null,
    }));
  }

  // ── 4. Aggregate All Signals ──────────────────────────────────────
  events.push(createTradingEvent('state_change', { state: 'deciding', symbol: input.symbol }));

  // Use Sven's learned weights instead of defaults
  const weights = Object.entries(metrics.sourceWeights).map(([source, weight]) => ({ source, weight }));
  const aggregated = aggregateSignals(allSignals, weights);

  for (const sig of allSignals) {
    events.push(createTradingEvent('signal_generated', {
      source: sig.source,
      direction: sig.direction,
      strength: sig.strength,
      symbol: sig.symbol,
    }));
  }

  const minSignalStrength = input.paperTradeMode ? 0.15 : 0.3;
  if (!aggregated || aggregated.strength < minSignalStrength) {
    // Not enough conviction — hold
    const decision = buildDecision('hold', input.symbol, allSignals, {}, `Insufficient signal conviction (${(aggregated?.strength ?? 0).toFixed(2)} < ${minSignalStrength})`);    
    events.push(createTradingEvent('decision_made', {
      type: 'hold',
      symbol: input.symbol,
      reason: 'Insufficient signal conviction',
      signalCount: allSignals.length,
      aggregatedStrength: aggregated?.strength ?? 0,
    }));

    return {
      decision,
      kronosPrediction,
      mirofishResult,
      newsSignals,
      technicalAnalysis: ta,
      aggregatedSignal: aggregated,
      riskChecks: [],
      order: null,
      events,
      updatedLearningMetrics: metrics,
      updatedCircuitBreaker: cb,
    };
  }

  // ── 4b. Conflicting Source Filter — resolve before neutral check ──
  const kronosSignal = allSignals.find((s) => s.source === 'kronos');
  const mirofishSig = allSignals.find((s) => s.source === 'mirofish');
  if (kronosSignal && mirofishSig && kronosSignal.direction !== 'close' && mirofishSig.direction !== 'close') {
    const kronosLong = kronosSignal.direction === 'long';
    const mirofishLong = mirofishSig.direction === 'long';
    if (kronosLong !== mirofishLong) {
      if (input.paperTradeMode) {
        // Paper mode: override aggregation to use Kronos direction (actual market data)
        // MiroFish has inherent mean-reversion bias from strategy mix; Kronos follows price action
        aggregated.direction = kronosSignal.direction;
        aggregated.strength = kronosSignal.strength * 0.75; // Penalize for lack of consensus
        events.push(createTradingEvent('signal_override', {
          reason: 'Conflicting sources — using Kronos (data-driven) over MiroFish (mean-reversion bias)',
          kronosDirection: kronosSignal.direction,
          mirofishDirection: mirofishSig.direction,
        }));
      } else {
        // Live mode: skip — too risky when primary sources disagree
        const decision = buildDecision('hold', input.symbol, allSignals, {},
          `Conflicting signals — Kronos: ${kronosSignal.direction}, MiroFish: ${mirofishSig.direction}. Skipping trade until sources align.`);
        events.push(createTradingEvent('decision_made', {
          type: 'hold',
          symbol: input.symbol,
          reason: 'Conflicting primary signal sources',
          kronosDirection: kronosSignal.direction,
          mirofishDirection: mirofishSig.direction,
        }));

        return {
          decision,
          kronosPrediction,
          mirofishResult,
          newsSignals,
          technicalAnalysis: ta,
          aggregatedSignal: aggregated,
          riskChecks: [],
          order: null,
          events,
          updatedLearningMetrics: metrics,
          updatedCircuitBreaker: cb,
        };
      }
    }
  }

  // ── 4c. Neutral Direction Filter — skip when no directional edge ──
  if (aggregated.direction === 'close') {
    const decision = buildDecision('hold', input.symbol, allSignals, {}, `No directional edge — signals are neutral (long/short equally weighted)`);
    events.push(createTradingEvent('decision_made', {
      type: 'hold',
      symbol: input.symbol,
      reason: 'No directional edge — neutral signals',
      signalCount: allSignals.length,
      aggregatedStrength: aggregated.strength,
    }));

    return {
      decision,
      kronosPrediction,
      mirofishResult,
      newsSignals,
      technicalAnalysis: ta,
      aggregatedSignal: aggregated,
      riskChecks: [],
      order: null,
      events,
      updatedLearningMetrics: metrics,
      updatedCircuitBreaker: cb,
    };
  }

  // ── 4d. TA Veto — block trades contradicted by technical indicators ──
  // Sven learned this the hard way: 7 trades, 0 wins, -$683 P&L.
  // Root cause: shorting assets during bullish TA (RSI 66 + MACD bullish
  // crossover on ENJ while shorting it). The TA indicators see what
  // Kronos/MiroFish miss — actual price momentum and overbought/oversold.
  if (ta.rsi || ta.macd || ta.bollinger) {
    let vetoReason = '';
    const dir = aggregated.direction;

    // Block shorting when TA says momentum is strongly bullish
    if (dir === 'short') {
      if (ta.macd?.crossover === 'bullish') {
        vetoReason = `TA veto: MACD bullish crossover contradicts short entry`;
      } else if (ta.rsi && ta.rsi.value < 35) {
        vetoReason = `TA veto: RSI ${ta.rsi.value.toFixed(0)} oversold — shorting oversold assets leads to reversal losses`;
      } else if (ta.bollinger && ta.bollinger.percentB < 0.1) {
        vetoReason = `TA veto: price at lower Bollinger Band (%B=${ta.bollinger.percentB.toFixed(2)}) — shorting bottom is high-risk`;
      } else if (ta.direction === 'long' && ta.confluence >= 2) {
        vetoReason = `TA veto: ${ta.confluence}/3 indicators say LONG with strength ${(ta.strength * 100).toFixed(0)}% — contradicts short`;
      }
    }

    // Block going long when TA says momentum is strongly bearish
    if (dir === 'long') {
      if (ta.macd?.crossover === 'bearish') {
        vetoReason = `TA veto: MACD bearish crossover contradicts long entry`;
      } else if (ta.rsi && ta.rsi.value > 75) {
        vetoReason = `TA veto: RSI ${ta.rsi.value.toFixed(0)} overbought — buying overbought assets leads to reversal losses`;
      } else if (ta.bollinger && ta.bollinger.percentB > 0.95) {
        vetoReason = `TA veto: price at upper Bollinger Band (%B=${ta.bollinger.percentB.toFixed(2)}) — buying top is high-risk`;
      } else if (ta.direction === 'short' && ta.confluence >= 2) {
        vetoReason = `TA veto: ${ta.confluence}/3 indicators say SHORT with strength ${(ta.strength * 100).toFixed(0)}% — contradicts long`;
      }
    }

    if (vetoReason) {
      const decision = buildDecision('hold', input.symbol, allSignals, {}, vetoReason);
      events.push(createTradingEvent('decision_made', {
        type: 'hold',
        symbol: input.symbol,
        reason: vetoReason,
        aggregatedDirection: dir,
        taDirection: ta.direction,
        taStrength: ta.strength,
        taConfluence: ta.confluence,
        rsi: ta.rsi?.value ?? null,
        macdCrossover: ta.macd?.crossover ?? null,
        bollingerPercentB: ta.bollinger?.percentB ?? null,
      }));

      return {
        decision,
        kronosPrediction,
        mirofishResult,
        newsSignals,
        technicalAnalysis: ta,
        aggregatedSignal: aggregated,
        riskChecks: [],
        order: null,
        events,
        updatedLearningMetrics: metrics,
        updatedCircuitBreaker: cb,
      };
    }
  }

  // ── 4d. TA Veto — block trades contradicted by technical indicators ──
  // Sven learned this the hard way: 7 trades, 0 wins, -$683 P&L.
  // Root cause: shorting assets during bullish TA (RSI 66 + MACD bullish
  // crossover on ENJ while shorting it). The TA indicators see what
  // Kronos/MiroFish miss — actual price momentum and overbought/oversold.
  if (ta.rsi || ta.macd || ta.bollinger) {
    let vetoReason = '';
    const dir = aggregated.direction;

    // Block shorting when TA says momentum is strongly bullish
    if (dir === 'short') {
      if (ta.macd?.crossover === 'bullish') {
        vetoReason = `TA veto: MACD bullish crossover contradicts short entry`;
      } else if (ta.rsi && ta.rsi.value < 35) {
        vetoReason = `TA veto: RSI ${ta.rsi.value.toFixed(0)} oversold — shorting oversold assets leads to reversal losses`;
      } else if (ta.bollinger && ta.bollinger.percentB < 0.1) {
        vetoReason = `TA veto: price at lower Bollinger Band (%B=${ta.bollinger.percentB.toFixed(2)}) — shorting bottom is high-risk`;
      } else if (ta.direction === 'long' && ta.confluence >= 2) {
        vetoReason = `TA veto: ${ta.confluence}/3 indicators say LONG with strength ${(ta.strength * 100).toFixed(0)}% — contradicts short`;
      }
    }

    // Block going long when TA says momentum is strongly bearish
    if (dir === 'long') {
      if (ta.macd?.crossover === 'bearish') {
        vetoReason = `TA veto: MACD bearish crossover contradicts long entry`;
      } else if (ta.rsi && ta.rsi.value > 75) {
        vetoReason = `TA veto: RSI ${ta.rsi.value.toFixed(0)} overbought — buying overbought assets leads to reversal losses`;
      } else if (ta.bollinger && ta.bollinger.percentB > 0.95) {
        vetoReason = `TA veto: price at upper Bollinger Band (%B=${ta.bollinger.percentB.toFixed(2)}) — buying top is high-risk`;
      } else if (ta.direction === 'short' && ta.confluence >= 2) {
        vetoReason = `TA veto: ${ta.confluence}/3 indicators say SHORT with strength ${(ta.strength * 100).toFixed(0)}% — contradicts long`;
      }
    }

    if (vetoReason) {
      const decision = buildDecision('hold', input.symbol, allSignals, {}, vetoReason);
      events.push(createTradingEvent('decision_made', {
        type: 'hold',
        symbol: input.symbol,
        reason: vetoReason,
        aggregatedDirection: dir,
        taDirection: ta.direction,
        taStrength: ta.strength,
        taConfluence: ta.confluence,
        rsi: ta.rsi?.value ?? null,
        macdCrossover: ta.macd?.crossover ?? null,
        bollingerPercentB: ta.bollinger?.percentB ?? null,
      }));

      return {
        decision,
        kronosPrediction,
        mirofishResult,
        newsSignals,
        technicalAnalysis: ta,
        aggregatedSignal: aggregated,
        riskChecks: [],
        order: null,
        events,
        updatedLearningMetrics: metrics,
        updatedCircuitBreaker: cb,
      };
    }
  }

  // ── 5. Risk Checks ───────────────────────────────────────────────
  const strategyDef = new StrategyRegistry().list()[0];
  const baseRiskConfig = strategyDef?.riskParameters ?? {
    maxPositionPct: 0.05,
    maxExposurePct: 0.50,
    maxDailyLossPct: 0.03,
    minConfidence: 0.65,
    mandatoryStopLoss: true,
  };
  const riskConfig = input.paperTradeMode
    ? { ...baseRiskConfig, minConfidence: 0.25, maxDailyLossPct: 0.10, maxExposurePct: 0.80 }
    : baseRiskConfig;

  const strategyContext: StrategyContext = {
    capital: input.portfolio.totalCapital,
    positions: new Map(input.portfolio.positions.map((p) => [p.symbol, {
      symbol: p.symbol,
      side: p.side,
      quantity: p.quantity,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice,
      unrealizedPnl: p.realizedPnl,
    }])),
    openOrders: input.portfolio.openOrderCount,
    dailyPnl: input.portfolio.totalUnrealizedPnl,
    drawdown: cb.currentDrawdownPct,
    timestamp: new Date(),
  };

  // Add stop loss to the signal from Kronos prediction
  const signalWithSl: Signal = {
    ...aggregated,
    stopLoss: aggregated.direction === 'long'
      ? input.currentPrice * 0.97   // 3% stop loss for long
      : input.currentPrice * 1.03,  // 3% stop loss for short
    sizePct: undefined,
  };

  const riskChecks = runAllRiskChecks(signalWithSl, strategyContext, riskConfig);
  const allPassed = riskChecksPassed(riskChecks);

  if (!allPassed) {
    const failedChecks = riskChecks.filter((r) => !r.passed).map((r) => r.rule);

    events.push(createTradingEvent('risk_alert', {
      symbol: input.symbol,
      failedChecks,
      riskChecks: riskChecks.map((r) => ({ rule: r.rule, passed: r.passed, message: r.message })),
    }));

    const riskCheckMap: Record<string, boolean> = {};
    for (const rc of riskChecks) riskCheckMap[rc.rule] = rc.passed;

    const decision = buildDecision('skip', input.symbol, allSignals, riskCheckMap, `Risk check failed: ${failedChecks.join(', ')}`);
    events.push(createTradingEvent('decision_made', {
      type: 'skip',
      symbol: input.symbol,
      reason: `Risk check failed: ${failedChecks.join(', ')}`,
    }));

    return {
      decision,
      kronosPrediction,
      mirofishResult,
      newsSignals,
      technicalAnalysis: ta,
      aggregatedSignal: aggregated,
      riskChecks,
      order: null,
      events,
      updatedLearningMetrics: metrics,
      updatedCircuitBreaker: cb,
    };
  }

  // ── 6. Position Sizing ────────────────────────────────────────────
  const stopLossPrice = signalWithSl.stopLoss ?? input.currentPrice * (aggregated.direction === 'long' ? 0.97 : 1.03);
  const positionSize = fixedFractionalSize(
    input.portfolio.availableCapital,
    riskConfig.maxPositionPct,
    input.currentPrice,
    stopLossPrice,
  );

  // ── 7. Create Order ───────────────────────────────────────────────
  events.push(createTradingEvent('state_change', { state: 'executing', symbol: input.symbol }));

  const order = createOrder({
    strategyId: 'sven-autonomous',
    symbol: input.symbol,
    exchange: input.config.mode === 'live' ? 'binance' : input.config.mode === 'internal' ? 'internal' : 'paper',
    side: aggregated.direction === 'long' ? 'buy' : 'sell',
    type: 'market',
    quantity: Math.max(0.001, positionSize),
    stopPrice: stopLossPrice,
  });

  const riskCheckMap: Record<string, boolean> = {};
  for (const rc of riskChecks) riskCheckMap[rc.rule] = rc.passed;

  const decision = buildDecision(
    'enter',
    input.symbol,
    allSignals,
    riskCheckMap,
    `${aggregated.direction.toUpperCase()} ${input.symbol} — Kronos: ${kronosPrediction?.horizons[0]?.predictedDirection ?? 'n/a'}, MiroFish: ${mirofishResult?.consensusDirection ?? 'n/a'} (${((mirofishResult?.consensusStrength ?? 0) * 100).toFixed(0)}%), News signals: ${newsSignals.length}, Aggregated strength: ${(aggregated.strength * 100).toFixed(0)}%`,
  );

  events.push(createTradingEvent('decision_made', {
    type: 'enter',
    symbol: input.symbol,
    direction: aggregated.direction,
    strength: aggregated.strength,
    positionSize,
    reasoning: decision.reasoning,
  }));

  events.push(createTradingEvent('order_placed', {
    orderId: order.id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    quantity: order.quantity,
    exchange: order.exchange,
  }));

  return {
    decision,
    kronosPrediction,
    mirofishResult,
    newsSignals,
    technicalAnalysis: ta,
    aggregatedSignal: aggregated,
    riskChecks,
    order,
    events,
    updatedLearningMetrics: metrics,
    updatedCircuitBreaker: cb,
  };
}

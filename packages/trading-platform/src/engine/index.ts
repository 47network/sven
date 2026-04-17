// ---------------------------------------------------------------------------
// @sven/trading-platform — Trading Engine Core
// ---------------------------------------------------------------------------
// Strategy framework, signal types, strategy registry, signal aggregation,
// and autonomous trading loop configuration.
// ---------------------------------------------------------------------------

import type { Candle, Tick, Timeframe } from '../market-data/index.js';

/* ── Task Classification ───────────────────────────────────────────────── */

export type TaskType = 'analysis' | 'prediction' | 'execution' | 'monitoring' | 'backtesting';

/* ── Signals ───────────────────────────────────────────────────────────── */

export type SignalDirection = 'long' | 'short' | 'close';

export interface Signal {
  id: string;
  symbol: string;
  direction: SignalDirection;
  strength: number;            // 0.0–1.0
  source: string;              // strategy or model name
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  sizePct?: number;            // % of available capital
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
}

/* ── Strategy Interface ────────────────────────────────────────────────── */

export interface RiskConfig {
  maxPositionPct: number;
  maxExposurePct: number;
  maxDailyLossPct: number;
  minConfidence: number;
  mandatoryStopLoss: boolean;
}

export interface StrategyContext {
  capital: number;
  positions: Map<string, PositionSnapshot>;
  openOrders: number;
  dailyPnl: number;
  drawdown: number;
  timestamp: Date;
}

export interface PositionSnapshot {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  version: string;
  requiredTimeframes: Timeframe[];
  riskParameters: RiskConfig;
  isActive: boolean;

  onCandle(candle: Candle, context: StrategyContext): Signal[];
  onTick?(tick: Tick, context: StrategyContext): Signal[];
  onPrediction?(prediction: PredictionInput, context: StrategyContext): Signal[];
  onNews?(event: NewsInput, context: StrategyContext): Signal[];
}

export interface PredictionInput {
  symbol: string;
  model: string;
  direction: 'up' | 'down' | 'neutral';
  confidence: number;
  horizonCandles: number;
  predictedClose: number;
}

export interface NewsInput {
  headline: string;
  symbols: string[];
  sentiment: number;
  impactLevel: number; // 1–5
}

/* ── Built-in Strategy Definitions ─────────────────────────────────────── */

const DEFAULT_RISK: RiskConfig = {
  maxPositionPct: 0.05,
  maxExposurePct: 0.50,
  maxDailyLossPct: 0.03,
  minConfidence: 0.65,
  mandatoryStopLoss: true,
};

export interface StrategyDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  source: string;
  requiredTimeframes: Timeframe[];
  riskParameters: RiskConfig;
}

const BUILT_IN_STRATEGIES: StrategyDefinition[] = [
  {
    id: 'kronos-momentum',
    name: 'Kronos Momentum',
    description: 'Trade Kronos directional predictions above confidence threshold.',
    version: '1.0.0',
    source: 'kronos',
    requiredTimeframes: ['1h', '4h', '1d'],
    riskParameters: { ...DEFAULT_RISK, minConfidence: 0.70 },
  },
  {
    id: 'mirofish-consensus',
    name: 'MiroFish Consensus',
    description: 'Trade when MiroFish simulation consensus exceeds 70%.',
    version: '1.0.0',
    source: 'mirofish',
    requiredTimeframes: ['1h', '4h'],
    riskParameters: { ...DEFAULT_RISK, minConfidence: 0.70 },
  },
  {
    id: 'news-impact',
    name: 'News Impact Reactor',
    description: 'React to high-impact news events with configurable latency.',
    version: '1.0.0',
    source: 'news-intelligence',
    requiredTimeframes: ['5m', '15m'],
    riskParameters: { ...DEFAULT_RISK, maxPositionPct: 0.03 },
  },
  {
    id: 'ensemble-voter',
    name: 'Ensemble Voter',
    description: 'Weighted vote across all prediction sources.',
    version: '1.0.0',
    source: 'ensemble',
    requiredTimeframes: ['1h', '4h', '1d'],
    riskParameters: DEFAULT_RISK,
  },
  {
    id: 'macro-regime',
    name: 'Macro Regime Adjuster',
    description: 'Adjust risk parameters based on macro regime (expansion/recession/crisis).',
    version: '1.0.0',
    source: 'fred',
    requiredTimeframes: ['1d', '1w'],
    riskParameters: { ...DEFAULT_RISK, maxExposurePct: 0.30 },
  },
  {
    id: 'mean-reversion-bb',
    name: 'Bollinger Band Mean Reversion',
    description: 'Mean reversion entries when price touches Bollinger Bands.',
    version: '1.0.0',
    source: 'technical',
    requiredTimeframes: ['15m', '1h'],
    riskParameters: { ...DEFAULT_RISK, maxPositionPct: 0.03 },
  },
  {
    id: 'breakout-volume',
    name: 'Volume Breakout',
    description: 'Volume-confirmed breakout entries with momentum follow-through.',
    version: '1.0.0',
    source: 'technical',
    requiredTimeframes: ['1h', '4h'],
    riskParameters: DEFAULT_RISK,
  },
];

/* ── Strategy Registry ─────────────────────────────────────────────────── */

export class StrategyRegistry {
  private strategies: Map<string, StrategyDefinition> = new Map();

  constructor() {
    for (const s of BUILT_IN_STRATEGIES) {
      this.strategies.set(s.id, s);
    }
  }

  get(id: string): StrategyDefinition | undefined {
    return this.strategies.get(id);
  }

  list(): StrategyDefinition[] {
    return [...this.strategies.values()];
  }

  listBySource(source: string): StrategyDefinition[] {
    return this.list().filter((s) => s.source === source);
  }

  register(strategy: StrategyDefinition): void {
    this.strategies.set(strategy.id, strategy);
  }

  remove(id: string): boolean {
    return this.strategies.delete(id);
  }
}

/* ── Signal Aggregation ────────────────────────────────────────────────── */

export interface WeightedSource {
  source: string;
  weight: number; // 0.0–1.0
}

export const DEFAULT_SOURCE_WEIGHTS: WeightedSource[] = [
  { source: 'kronos', weight: 0.30 },
  { source: 'mirofish', weight: 0.25 },
  { source: 'news-intelligence', weight: 0.15 },
  { source: 'technical', weight: 0.20 },
  { source: 'ensemble', weight: 0.10 },
];

export function aggregateSignals(signals: Signal[], weights: WeightedSource[] = DEFAULT_SOURCE_WEIGHTS): Signal | null {
  if (signals.length === 0) return null;

  const weightMap = new Map(weights.map((w) => [w.source, w.weight]));

  let longScore = 0;
  let shortScore = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const w = weightMap.get(sig.source) ?? 0.1;
    totalWeight += w;
    if (sig.direction === 'long') longScore += sig.strength * w;
    else if (sig.direction === 'short') shortScore += sig.strength * w;
  }

  if (totalWeight === 0) return null;

  const netLong = longScore / totalWeight;
  const netShort = shortScore / totalWeight;
  // Require a meaningful difference to declare direction — prevents tiny bias from forcing all trades one way
  const scoreDiff = Math.abs(netLong - netShort);
  const minConviction = 0.10; // 10% minimum edge to declare directional
  const direction: SignalDirection = scoreDiff < minConviction ? 'close' : netLong > netShort ? 'long' : 'short';
  const strength = Math.max(netLong, netShort);

  return {
    id: `agg-${Date.now()}`,
    symbol: signals[0]!.symbol,
    direction,
    strength,
    source: 'aggregator',
    createdAt: new Date(),
    metadata: {
      longScore: netLong,
      shortScore: netShort,
      signalCount: signals.length,
      sources: signals.map((s) => s.source),
    },
  };
}

/* ── Autonomous Trading Loop Config ────────────────────────────────────── */

export interface TradingLoopConfig {
  /** Main loop interval in ms (default 60_000) */
  loopIntervalMs: number;
  /** MiroFish simulation interval in ms (default 900_000 / 15min) */
  mirofishIntervalMs: number;
  /** Portfolio rebalance interval in ms (default 3_600_000 / 1h) */
  rebalanceIntervalMs: number;
  /** Maximum signals to process per loop */
  maxSignalsPerLoop: number;
  /** Symbols being actively tracked */
  trackedSymbols: string[];
  /** Active strategy IDs */
  activeStrategies: string[];
  /** Trading mode */
  mode: 'paper' | 'internal' | 'live';
}

export const DEFAULT_LOOP_CONFIG: TradingLoopConfig = {
  loopIntervalMs: 60_000,
  mirofishIntervalMs: 900_000,
  rebalanceIntervalMs: 3_600_000,
  maxSignalsPerLoop: 50,
  trackedSymbols: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'],
  activeStrategies: ['kronos-momentum', 'ensemble-voter', 'mean-reversion-bb'],
  mode: 'paper',
};

/* ── Decision Logging ──────────────────────────────────────────────────── */

export type DecisionType = 'enter' | 'exit' | 'adjust' | 'hold' | 'skip';

export interface TradeDecision {
  id: string;
  createdAt: Date;
  decisionType: DecisionType;
  symbol: string;
  direction?: SignalDirection;
  signals: Signal[];
  confidence: number;
  riskCheckPassed: boolean;
  riskCheckDetails: Record<string, boolean>;
  orderId?: string;
  reasoning: string;
  portfolioSnapshot: Record<string, unknown>;
}

export function buildDecision(
  type: DecisionType,
  symbol: string,
  signals: Signal[],
  riskChecks: Record<string, boolean>,
  reasoning: string,
): TradeDecision {
  const confidence = signals.length > 0 ? signals.reduce((s, sig) => s + sig.strength, 0) / signals.length : 0;
  const allPassed = Object.values(riskChecks).every(Boolean);

  return {
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date(),
    decisionType: type,
    symbol,
    direction: signals[0]?.direction,
    signals,
    confidence,
    riskCheckPassed: allPassed,
    riskCheckDetails: riskChecks,
    reasoning,
    portfolioSnapshot: {},
  };
}

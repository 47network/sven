// ---------------------------------------------------------------------------
// @sven/trading-platform — Backtesting Engine
// ---------------------------------------------------------------------------
// Historical replay engine that simulates strategy execution on past data.
// Produces detailed trade logs, equity curves, and performance metrics.
// ---------------------------------------------------------------------------

import type { TradePerformance } from '../oms/index.js';
import { computeTradePerformance } from '../oms/index.js';

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface BacktestCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BacktestDirection = 'long' | 'short' | 'flat';

export interface BacktestSignal {
  timestamp: number;
  direction: BacktestDirection;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  metadata?: Record<string, unknown>;
}

export type StrategyFn = (
  candles: BacktestCandle[],
  currentIndex: number,
  state: Record<string, unknown>,
) => BacktestSignal | null;

export interface BacktestConfig {
  symbol: string;
  strategyName: string;
  strategy: StrategyFn;
  candles: BacktestCandle[];
  initialCapital: number;
  positionSizePct: number;      // % of capital per trade (0–1)
  commissionPct: number;        // per-trade commission rate
  slippageBps: number;          // basis points of slippage per fill
  maxOpenPositions: number;
  warmupBars: number;           // bars to skip before first signal
}

export interface BacktestTrade {
  entryTimestamp: number;
  exitTimestamp: number;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  commission: number;
  holdingBars: number;
  exitReason: 'signal' | 'stop_loss' | 'take_profit' | 'end_of_data';
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdownPct: number;
  positionCount: number;
}

export interface BacktestResult {
  symbol: string;
  strategyName: string;
  startDate: number;
  endDate: number;
  totalBars: number;
  initialCapital: number;
  finalEquity: number;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  performance: TradePerformance;
  monthlyReturns: MonthlyReturn[];
  config: Omit<BacktestConfig, 'strategy' | 'candles'>;
  completedAt: string;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  returnPct: number;
  trades: number;
}

/* ── Engine ─────────────────────────────────────────────────────────────── */

interface OpenPosition {
  direction: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  entryIndex: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function runBacktest(config: BacktestConfig): BacktestResult {
  const {
    candles, strategy, initialCapital, positionSizePct, commissionPct,
    slippageBps, maxOpenPositions, warmupBars, symbol, strategyName,
  } = config;

  let cash = initialCapital;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  const positions: OpenPosition[] = [];
  const state: Record<string, unknown> = {};
  let peak = initialCapital;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const price = candle.close;

    // Check stop loss / take profit on existing positions
    for (let p = positions.length - 1; p >= 0; p--) {
      const pos = positions[p];
      let exitReason: BacktestTrade['exitReason'] | null = null;
      let exitPrice = price;

      if (pos.direction === 'long') {
        if (pos.stopLoss != null && candle.low <= pos.stopLoss) {
          exitReason = 'stop_loss';
          exitPrice = pos.stopLoss;
        } else if (pos.takeProfit != null && candle.high >= pos.takeProfit) {
          exitReason = 'take_profit';
          exitPrice = pos.takeProfit;
        }
      } else {
        if (pos.stopLoss != null && candle.high >= pos.stopLoss) {
          exitReason = 'stop_loss';
          exitPrice = pos.stopLoss;
        } else if (pos.takeProfit != null && candle.low <= pos.takeProfit) {
          exitReason = 'take_profit';
          exitPrice = pos.takeProfit;
        }
      }

      if (exitReason) {
        const slippage = exitPrice * (slippageBps / 10_000);
        const adjExitPrice = pos.direction === 'long' ? exitPrice - slippage : exitPrice + slippage;
        const commission = adjExitPrice * pos.quantity * commissionPct;
        const dir = pos.direction === 'long' ? 1 : -1;
        const pnl = dir * (adjExitPrice - pos.entryPrice) * pos.quantity - commission;

        trades.push({
          entryTimestamp: candles[pos.entryIndex].timestamp,
          exitTimestamp: candle.timestamp,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: adjExitPrice,
          quantity: pos.quantity,
          pnl,
          pnlPct: pos.entryPrice > 0 ? (dir * (adjExitPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0,
          commission,
          holdingBars: i - pos.entryIndex,
          exitReason,
        });

        cash += pos.quantity * adjExitPrice - commission;
        positions.splice(p, 1);
      }
    }

    // Generate signal (only after warmup)
    if (i >= warmupBars) {
      const signal = strategy(candles, i, state);

      if (signal) {
        // Close opposing positions
        if (signal.direction === 'flat' || signal.direction !== positions[0]?.direction) {
          for (let p = positions.length - 1; p >= 0; p--) {
            const pos = positions[p];
            if (signal.direction === 'flat' || pos.direction !== signal.direction) {
              const slippage = price * (slippageBps / 10_000);
              const adjExit = pos.direction === 'long' ? price - slippage : price + slippage;
              const commission = adjExit * pos.quantity * commissionPct;
              const dir = pos.direction === 'long' ? 1 : -1;
              const pnl = dir * (adjExit - pos.entryPrice) * pos.quantity - commission;

              trades.push({
                entryTimestamp: candles[pos.entryIndex].timestamp,
                exitTimestamp: candle.timestamp,
                direction: pos.direction,
                entryPrice: pos.entryPrice,
                exitPrice: adjExit,
                quantity: pos.quantity,
                pnl,
                pnlPct: pos.entryPrice > 0 ? (dir * (adjExit - pos.entryPrice) / pos.entryPrice) * 100 : 0,
                commission,
                holdingBars: i - pos.entryIndex,
                exitReason: 'signal',
              });

              cash += pos.quantity * adjExit - commission;
              positions.splice(p, 1);
            }
          }
        }

        // Open new position
        if (signal.direction !== 'flat' && positions.length < maxOpenPositions) {
          const equity = cash + positions.reduce((s, p) => s + p.quantity * price, 0);
          const allocatedCapital = equity * positionSizePct;
          const slippage = price * (slippageBps / 10_000);
          const adjEntry = signal.direction === 'long' ? price + slippage : price - slippage;
          const quantity = Math.floor(allocatedCapital / adjEntry);

          if (quantity > 0 && adjEntry * quantity <= cash) {
            cash -= adjEntry * quantity;
            positions.push({
              direction: signal.direction,
              entryPrice: adjEntry,
              quantity,
              entryIndex: i,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
            });
          }
        }
      }
    }

    // Record equity point
    const posValue = positions.reduce((s, p) => {
      const dir = p.direction === 'long' ? 1 : -1;
      return s + p.quantity * (price + dir * (price - p.entryPrice));
    }, 0);
    const equity = cash + posValue;
    if (equity > peak) peak = equity;
    const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;

    equityCurve.push({
      timestamp: candle.timestamp,
      equity,
      drawdownPct,
      positionCount: positions.length,
    });
  }

  // Close remaining positions at last price
  const lastPrice = candles[candles.length - 1]?.close ?? 0;
  for (const pos of positions) {
    const slippage = lastPrice * (slippageBps / 10_000);
    const adjExit = pos.direction === 'long' ? lastPrice - slippage : lastPrice + slippage;
    const commission = adjExit * pos.quantity * commissionPct;
    const dir = pos.direction === 'long' ? 1 : -1;
    const pnl = dir * (adjExit - pos.entryPrice) * pos.quantity - commission;

    trades.push({
      entryTimestamp: candles[pos.entryIndex].timestamp,
      exitTimestamp: candles[candles.length - 1].timestamp,
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      exitPrice: adjExit,
      quantity: pos.quantity,
      pnl,
      pnlPct: pos.entryPrice > 0 ? (dir * (adjExit - pos.entryPrice) / pos.entryPrice) * 100 : 0,
      commission,
      holdingBars: candles.length - 1 - pos.entryIndex,
      exitReason: 'end_of_data',
    });
    cash += pos.quantity * adjExit - commission;
  }

  // Compute monthly returns
  const monthlyReturns = computeMonthlyReturns(trades, initialCapital);

  // Compute performance metrics
  const pnls = trades.map((t) => t.pnl);
  const holdingMs = trades.map((t) => (t.exitTimestamp - t.entryTimestamp));
  const performance = computeTradePerformance(pnls, initialCapital, holdingMs);

  return {
    symbol,
    strategyName,
    startDate: candles[0]?.timestamp ?? 0,
    endDate: candles[candles.length - 1]?.timestamp ?? 0,
    totalBars: candles.length,
    initialCapital,
    finalEquity: cash,
    trades,
    equityCurve,
    performance,
    monthlyReturns,
    config: {
      symbol,
      strategyName,
      initialCapital,
      positionSizePct,
      commissionPct,
      slippageBps,
      maxOpenPositions,
      warmupBars,
    },
    completedAt: new Date().toISOString(),
  };
}

/* ── Monthly Returns ───────────────────────────────────────────────────── */

function computeMonthlyReturns(trades: BacktestTrade[], initialCapital: number): MonthlyReturn[] {
  const byMonth = new Map<string, { pnl: number; count: number }>();

  for (const t of trades) {
    const d = new Date(t.exitTimestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const existing = byMonth.get(key) ?? { pnl: 0, count: 0 };
    existing.pnl += t.pnl;
    existing.count += 1;
    byMonth.set(key, existing);
  }

  const results: MonthlyReturn[] = [];
  for (const [key, val] of byMonth) {
    const [year, month] = key.split('-').map(Number);
    results.push({
      year,
      month,
      returnPct: initialCapital > 0 ? (val.pnl / initialCapital) * 100 : 0,
      trades: val.count,
    });
  }

  return results.sort((a, b) => a.year - b.year || a.month - b.month);
}

/* ── Built-in Strategies ───────────────────────────────────────────────── */

export function smaStrategy(shortPeriod: number, longPeriod: number): StrategyFn {
  return (candles, idx, _state) => {
    if (idx < longPeriod) return null;

    const shortSlice = candles.slice(idx - shortPeriod + 1, idx + 1);
    const longSlice = candles.slice(idx - longPeriod + 1, idx + 1);
    const shortSma = shortSlice.reduce((s, c) => s + c.close, 0) / shortPeriod;
    const longSma = longSlice.reduce((s, c) => s + c.close, 0) / longPeriod;
    const price = candles[idx].close;

    if (shortSma > longSma) {
      return { timestamp: candles[idx].timestamp, direction: 'long', confidence: 0.6, stopLoss: price * 0.97, takeProfit: price * 1.06 };
    } else if (shortSma < longSma) {
      return { timestamp: candles[idx].timestamp, direction: 'short', confidence: 0.6, stopLoss: price * 1.03, takeProfit: price * 0.94 };
    }
    return null;
  };
}

export function rsiStrategy(period: number, oversold: number, overbought: number): StrategyFn {
  return (candles, idx, _state) => {
    if (idx < period + 1) return null;

    let gains = 0, losses = 0;
    for (let i = idx - period + 1; i <= idx; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
    const rsi = 100 - 100 / (1 + rs);
    const price = candles[idx].close;

    if (rsi < oversold) {
      return { timestamp: candles[idx].timestamp, direction: 'long', confidence: (oversold - rsi) / oversold, stopLoss: price * 0.96, takeProfit: price * 1.08 };
    } else if (rsi > overbought) {
      return { timestamp: candles[idx].timestamp, direction: 'short', confidence: (rsi - overbought) / (100 - overbought), stopLoss: price * 1.04, takeProfit: price * 0.92 };
    }
    return { timestamp: candles[idx].timestamp, direction: 'flat', confidence: 0 };
  };
}

export function meanReversionStrategy(lookback: number, zThreshold: number): StrategyFn {
  return (candles, idx, _state) => {
    if (idx < lookback) return null;

    const slice = candles.slice(idx - lookback + 1, idx + 1);
    const mean = slice.reduce((s, c) => s + c.close, 0) / lookback;
    const variance = slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / lookback;
    const stdDev = Math.sqrt(variance);
    const price = candles[idx].close;
    const z = stdDev > 0 ? (price - mean) / stdDev : 0;

    if (z < -zThreshold) {
      return { timestamp: candles[idx].timestamp, direction: 'long', confidence: Math.min(1, Math.abs(z) / 4), stopLoss: price * 0.95, takeProfit: mean };
    } else if (z > zThreshold) {
      return { timestamp: candles[idx].timestamp, direction: 'short', confidence: Math.min(1, Math.abs(z) / 4), stopLoss: price * 1.05, takeProfit: mean };
    }
    return null;
  };
}

export const BUILT_IN_STRATEGIES: Record<string, { name: string; description: string; create: () => StrategyFn }> = {
  'sma-crossover-20-50': {
    name: 'SMA Crossover 20/50',
    description: 'Classic moving average crossover with 20 and 50 period SMAs',
    create: () => smaStrategy(20, 50),
  },
  'sma-crossover-9-21': {
    name: 'SMA Crossover 9/21',
    description: 'Fast moving average crossover with 9 and 21 period SMAs',
    create: () => smaStrategy(9, 21),
  },
  'rsi-30-70': {
    name: 'RSI Reversal 30/70',
    description: 'Buy oversold (RSI < 30), sell overbought (RSI > 70) with 14-period RSI',
    create: () => rsiStrategy(14, 30, 70),
  },
  'rsi-20-80': {
    name: 'RSI Extreme 20/80',
    description: 'Aggressive RSI with extreme thresholds and 14-period',
    create: () => rsiStrategy(14, 20, 80),
  },
  'mean-reversion-2': {
    name: 'Mean Reversion Z=2',
    description: 'Buy/sell when price is 2 standard deviations from 20-bar mean',
    create: () => meanReversionStrategy(20, 2),
  },
  'mean-reversion-1.5': {
    name: 'Mean Reversion Z=1.5',
    description: 'Moderate mean reversion with 1.5σ threshold over 30 bars',
    create: () => meanReversionStrategy(30, 1.5),
  },
};

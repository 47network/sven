import {
  StrategyRegistry,
  aggregateSignals,
  DEFAULT_SOURCE_WEIGHTS,
  type Signal,
  type StrategyContext,
  type RiskConfig,
} from '@sven/trading-platform/engine';
import {
  runAllRiskChecks,
  riskChecksPassed,
  calculateDrawdown,
  fixedFractionalSize,
} from '@sven/trading-platform/risk';
import { computeTradePerformance } from '@sven/trading-platform/oms';
import type { Timeframe } from '@sven/trading-platform/market-data';

const registry = new StrategyRegistry();

const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxPositionPct: 0.02,
  maxExposurePct: 0.50,
  maxDailyLossPct: 0.03,
  minConfidence: 0.50,
  mandatoryStopLoss: true,
};

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'run': {
      const strategyId = input.strategy_id as string;
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const capital = (input.capital as number) ?? 100_000;
      const timeframe = ((input.timeframe as string) ?? '1h') as Timeframe;
      const numCandles = (input.candles as number) ?? 50;

      const strategy = strategyId ? registry.get(strategyId) : undefined;
      const strategyName = strategy?.name ?? strategyId ?? 'default_momentum';

      const basePrice = (input.base_price as number) ?? 60000;
      const closePrices: number[] = [basePrice];
      for (let i = 1; i < numCandles; i++) {
        const change = (Math.random() - 0.48) * basePrice * 0.02;
        closePrices.push(closePrices[i - 1]! + change);
      }

      const closedPnls: number[] = [];
      for (let i = 5; i < closePrices.length; i += 5) {
        const entry = closePrices[i - 5]!;
        const exit = closePrices[i]!;
        closedPnls.push(exit - entry);
      }

      const perf = computeTradePerformance(closedPnls, capital);

      const equityCurve: number[] = [capital];
      for (const pnl of closedPnls) {
        equityCurve.push(equityCurve[equityCurve.length - 1]! + pnl);
      }
      const drawdown = calculateDrawdown(equityCurve);

      const lastPrice = closePrices[closePrices.length - 1]!;
      const stopDistance = lastPrice * 0.015;
      const positionSize = fixedFractionalSize(capital, 0.02, lastPrice, lastPrice - stopDistance);

      return {
        result: {
          strategy: strategyName,
          symbol,
          timeframe,
          candleCount: numCandles,
          tradeCount: closedPnls.length,
          performance: {
            totalReturn: perf.totalReturn,
            avgTradeReturn: perf.avgTradeReturn,
            winRate: perf.winRate,
            bestTrade: perf.bestTrade,
            worstTrade: perf.worstTrade,
            profitFactor: perf.profitFactor,
            sharpeRatio: perf.sharpeRatio,
          },
          drawdown: {
            maxDrawdown: drawdown.maxDrawdown,
            currentDrawdown: drawdown.currentDrawdown,
          },
          nextTradeSizing: {
            positionSize: positionSize.toFixed(4),
            riskPct: 0.02,
            stopDistance: stopDistance.toFixed(2),
          },
        },
      };
    }

    case 'available_strategies': {
      const strategies = registry.list();
      return {
        result: {
          strategies: strategies.map((s) => ({
            id: s.id,
            name: s.name,
            source: s.source,
            requiredTimeframes: s.requiredTimeframes,
          })),
          count: strategies.length,
        },
      };
    }

    case 'risk_check': {
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const direction = ((input.direction as string) ?? 'long') as Signal['direction'];
      const strength = (input.strength as number) ?? 0.65;
      const capital = (input.capital as number) ?? 100_000;

      const signal: Signal = {
        id: `sig-backtest-${Date.now()}`,
        createdAt: new Date(),
        symbol,
        direction,
        strength,
        source: 'backtest',
        stopLoss: (input.stop_loss as number) ?? undefined,
        metadata: {},
      };

      const context: StrategyContext = {
        capital,
        positions: new Map(),
        openOrders: 0,
        dailyPnl: 0,
        drawdown: 0,
        timestamp: new Date(),
      };

      const results = runAllRiskChecks(signal, context, DEFAULT_RISK_CONFIG);
      const passed = riskChecksPassed(results);

      return {
        result: {
          passed,
          checks: results.map((r) => ({
            rule: r.rule,
            passed: r.passed,
            message: r.message,
          })),
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: run, available_strategies, risk_check` };
  }
}

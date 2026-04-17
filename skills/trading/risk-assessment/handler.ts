import {
  runAllRiskChecks,
  riskChecksPassed,
  fixedFractionalSize,
  kellyCriterionSize,
  volatilityBasedSize,
  confidenceWeightedSize,
  evaluateCircuitBreakers,
  anyBreakerTripped,
  getTrippedActions,
  calculateDrawdown,
  checkCorrelatedExposure,
  DEFAULT_CIRCUIT_CONFIG,
} from '@sven/trading-platform/risk';
import type { RiskConfig, StrategyContext, SignalDirection } from '@sven/trading-platform/engine';

const DEFAULT_RISK: RiskConfig = {
  maxPositionPct: 0.05,
  maxExposurePct: 0.50,
  maxDailyLossPct: 0.03,
  minConfidence: 0.65,
  mandatoryStopLoss: true,
};

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'check_signal': {
      const signal = {
        id: `sig-${Date.now()}`,
        symbol: (input.symbol as string) ?? 'BTC/USDT',
        direction: ((input.direction as string) ?? 'long') as SignalDirection,
        strength: (input.strength as number) ?? 0.75,
        source: 'manual',
        createdAt: new Date(),
        stopLoss: input.stop_loss as number | undefined,
        sizePct: input.risk_pct as number | undefined,
        metadata: {},
      };

      const context: StrategyContext = {
        capital: (input.capital as number) ?? 100_000,
        positions: new Map(),
        openOrders: 0,
        dailyPnl: 0,
        drawdown: 0,
        timestamp: new Date(),
      };

      const results = runAllRiskChecks(signal, context, DEFAULT_RISK);
      const passed = riskChecksPassed(results);

      return {
        result: {
          passed,
          checks: results.map((r) => ({
            rule: r.rule,
            passed: r.passed,
            message: r.message,
            threshold: r.threshold,
            actual: r.actual,
          })),
        },
      };
    }

    case 'position_size': {
      const capital = (input.capital as number) ?? 100_000;
      const riskPct = (input.risk_pct as number) ?? 0.02;
      const entryPrice = (input.entry_price as number) ?? 60000;
      const stopLoss = (input.stop_loss as number) ?? 58000;
      const winRate = (input.win_rate as number) ?? 0.55;
      const avgWin = (input.avg_win as number) ?? 300;
      const avgLoss = (input.avg_loss as number) ?? 200;

      const fixed = fixedFractionalSize(capital, riskPct, entryPrice, stopLoss);
      const kelly = kellyCriterionSize(winRate, avgWin, avgLoss);
      const volBased = volatilityBasedSize(capital, Math.abs(entryPrice - stopLoss) * 1.5, riskPct, entryPrice);
      const confWeighted = confidenceWeightedSize(fixed, (input.strength as number) ?? 0.75, 0.65);

      return {
        result: {
          fixedFractional: { units: fixed.toFixed(4), capitalAtRisk: (capital * riskPct).toFixed(2) },
          kellyCriterion: { fractionOfCapital: (kelly * 100).toFixed(2) + '%', rawKelly: kelly.toFixed(4) },
          volatilityBased: { units: volBased.toFixed(4) },
          confidenceWeighted: { units: confWeighted.toFixed(4) },
          recommended: Math.min(fixed, confWeighted).toFixed(4),
        },
      };
    }

    case 'circuit_breakers': {
      const context: StrategyContext = {
        capital: (input.capital as number) ?? 100_000,
        positions: new Map(),
        openOrders: 0,
        dailyPnl: (input.daily_pnl as number) ?? 0,
        drawdown: (input.drawdown as number) ?? 0,
        timestamp: new Date(),
      };

      const breakers = evaluateCircuitBreakers(
        context,
        DEFAULT_CIRCUIT_CONFIG,
        (input.consecutive_losses as number) ?? 0,
        (input.recent_price_change_pct as number) ?? 0,
        (input.model_agreement as number) ?? 0.8,
      );

      return {
        result: {
          anyTripped: anyBreakerTripped(breakers),
          trippedActions: getTrippedActions(breakers),
          breakers: breakers.map((b) => ({
            id: b.id,
            name: b.name,
            action: b.action,
            isTripped: b.isTripped,
          })),
        },
      };
    }

    case 'exposure': {
      const capital = (input.capital as number) ?? 100_000;
      const positions = new Map<string, { quantity: number; currentPrice: number }>();
      // In production populated from real positions
      const results = checkCorrelatedExposure(positions, capital);
      return { result: { checks: results } };
    }

    case 'drawdown': {
      const curve = (input.equity_curve as number[]) ?? [100000, 102000, 98000, 95000, 97000];
      const dd = calculateDrawdown(curve);
      return { result: { maxDrawdown: (dd.maxDrawdown * 100).toFixed(2) + '%', currentDrawdown: (dd.currentDrawdown * 100).toFixed(2) + '%' } };
    }

    case 'full_assessment': {
      const symbol = (input.symbol as string) ?? 'BTC/USDT';
      const direction = ((input.direction as string) ?? 'long') as SignalDirection;
      const strength = (input.strength as number) ?? 0.75;
      const capital = (input.capital as number) ?? 100_000;

      // Risk checks
      const signal = { id: `sig-${Date.now()}`, symbol, direction, strength, source: 'manual', createdAt: new Date(), stopLoss: input.stop_loss as number | undefined, metadata: {} };
      const context: StrategyContext = { capital, positions: new Map(), openOrders: 0, dailyPnl: 0, drawdown: 0, timestamp: new Date() };
      const riskResults = runAllRiskChecks(signal, context, DEFAULT_RISK);

      // Circuit breakers
      const breakers = evaluateCircuitBreakers(context, DEFAULT_CIRCUIT_CONFIG, 0, 0, 0.8);

      // Position sizing
      const entryPrice = (input.entry_price as number) ?? 60000;
      const stopLoss = (input.stop_loss as number) ?? 58000;
      const size = fixedFractionalSize(capital, 0.02, entryPrice, stopLoss);

      return {
        result: {
          symbol, direction, strength,
          riskChecksPassed: riskChecksPassed(riskResults),
          riskChecks: riskResults.map((r) => ({ rule: r.rule, passed: r.passed, message: r.message })),
          circuitBreakersTripped: anyBreakerTripped(breakers),
          trippedBreakers: getTrippedActions(breakers),
          recommendedSize: size.toFixed(4),
          verdict: riskChecksPassed(riskResults) && !anyBreakerTripped(breakers) ? 'APPROVED' : 'BLOCKED',
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: check_signal, position_size, circuit_breakers, exposure, drawdown, full_assessment` };
  }
}

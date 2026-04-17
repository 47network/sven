import {
  createOrder,
  applyTransition,
  type Order,
  type OrderSide,
  type OrderType,
} from '@sven/trading-platform/oms';
import {
  runAllRiskChecks,
  riskChecksPassed,
} from '@sven/trading-platform/risk';
import type { RiskConfig, StrategyContext } from '@sven/trading-platform/engine';

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
    case 'create': {
      const symbol = input.symbol as string;
      const side = input.side as OrderSide;
      const orderType = (input.order_type as OrderType) ?? 'market';
      const quantity = input.quantity as number;
      const strategyId = (input.strategy_id as string) ?? 'manual';

      if (!symbol || !side || !quantity) {
        return { error: 'Missing required fields: symbol, side, quantity' };
      }

      const order = createOrder({
        strategyId,
        symbol,
        exchange: 'paper',
        side,
        type: orderType,
        quantity,
        price: input.price as number | undefined,
        stopPrice: input.stop_price as number | undefined,
        trailPct: input.trail_pct as number | undefined,
      });

      // Build a mock signal for risk checking
      const signal = {
        id: order.id,
        symbol,
        direction: side === 'buy' ? 'long' as const : 'short' as const,
        strength: 0.75,
        source: strategyId,
        createdAt: new Date(),
        stopLoss: input.stop_price as number | undefined,
        metadata: {},
      };

      const context: StrategyContext = {
        capital: 100_000,
        positions: new Map(),
        openOrders: 0,
        dailyPnl: 0,
        drawdown: 0,
        timestamp: new Date(),
      };

      const riskResults = runAllRiskChecks(signal, context, DEFAULT_RISK);
      const passed = riskChecksPassed(riskResults);

      if (!passed) {
        const failures = riskResults.filter((r) => !r.passed);
        return {
          result: {
            order: null,
            riskCheckPassed: false,
            failures: failures.map((f) => ({ rule: f.rule, message: f.message })),
          },
        };
      }

      // Submit order
      const submitted = applyTransition(order, 'submit');
      if ('error' in submitted) return { error: submitted.error };

      return {
        result: {
          order: submitted.order,
          event: submitted.event,
          riskCheckPassed: true,
        },
      };
    }

    case 'cancel': {
      const orderId = input.order_id as string;
      if (!orderId) return { error: 'Missing order_id' };

      // In production this would query the order from DB
      const mockOrder: Order = {
        id: orderId,
        strategyId: 'unknown',
        symbol: 'BTC/USDT',
        exchange: 'paper',
        side: 'buy',
        type: 'limit',
        quantity: 0,
        timeInForce: 'GTC',
        status: 'submitted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const cancelled = applyTransition(mockOrder, 'cancel');
      if ('error' in cancelled) return { error: cancelled.error };
      return { result: { order: cancelled.order, event: cancelled.event } };
    }

    case 'status': {
      const orderId = input.order_id as string;
      if (!orderId) return { error: 'Missing order_id' };
      return { result: { orderId, status: 'submitted', message: 'Query order status from database in production' } };
    }

    case 'list': {
      return { result: { orders: [], message: 'Query open orders from database in production' } };
    }

    case 'fill_simulate': {
      const orderId = input.order_id as string;
      if (!orderId) return { error: 'Missing order_id' };

      const mockOrder: Order = {
        id: orderId,
        strategyId: 'manual',
        symbol: (input.symbol as string) ?? 'BTC/USDT',
        exchange: 'paper',
        side: 'buy',
        type: 'market',
        quantity: input.quantity as number ?? 1,
        timeInForce: 'GTC',
        status: 'submitted',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const filled = applyTransition(mockOrder, 'fill');
      if ('error' in filled) return { error: filled.error };
      return { result: { order: { ...filled.order, fillPrice: input.price ?? 0, fillQuantity: mockOrder.quantity }, event: filled.event } };
    }

    default:
      return { error: `Unknown action "${action}". Use: create, cancel, status, list, fill_simulate` };
  }
}

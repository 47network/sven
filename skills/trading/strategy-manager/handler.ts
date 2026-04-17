import {
  StrategyRegistry,
  aggregateSignals,
  DEFAULT_SOURCE_WEIGHTS,
  DEFAULT_LOOP_CONFIG,
  type StrategyDefinition,
  type Signal,
  type WeightedSource,
} from '@sven/trading-platform/engine';

const registry = new StrategyRegistry();

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'list': {
      const strategies = registry.list();
      return {
        result: {
          strategies: strategies.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            source: s.source,
            version: s.version,
            requiredTimeframes: s.requiredTimeframes,
          })),
          count: strategies.length,
        },
      };
    }

    case 'get': {
      const id = input.strategy_id as string;
      if (!id) return { error: 'Missing strategy_id' };
      const strategy = registry.get(id);
      if (!strategy) return { error: `Strategy "${id}" not found` };
      return {
        result: {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          source: strategy.source,
          version: strategy.version,
          requiredTimeframes: strategy.requiredTimeframes,
          riskParameters: strategy.riskParameters,
        },
      };
    }

    case 'register': {
      const def = input.strategy as Record<string, unknown> | undefined;
      if (!def) return { error: 'Missing strategy definition object' };

      const strategy: StrategyDefinition = {
        id: (def.id as string) ?? `strat-${Date.now()}`,
        name: (def.name as string) ?? '',
        description: (def.description as string) ?? '',
        source: (def.source as string) ?? 'community',
        version: (def.version as string) ?? '1.0.0',
        requiredTimeframes: (def.requiredTimeframes as StrategyDefinition['requiredTimeframes']) ?? ['1h'],
        riskParameters: (def.riskParameters as StrategyDefinition['riskParameters']) ?? {
          maxPositionPct: 0.02,
          maxExposurePct: 0.50,
          maxDailyLossPct: 0.03,
          minConfidence: 0.65,
          mandatoryStopLoss: true,
        },
      };

      registry.register(strategy);
      return { result: { registered: strategy.id, name: strategy.name, version: strategy.version } };
    }

    case 'remove': {
      const id = input.strategy_id as string;
      if (!id) return { error: 'Missing strategy_id' };
      const removed = registry.remove(id);
      if (!removed) return { error: `Strategy "${id}" not found` };
      return { result: { removed: true, id } };
    }

    case 'aggregate_signals': {
      const rawSignals = (input.signals as Array<{
        symbol: string;
        direction: string;
        strength: number;
        source: string;
      }>) ?? [];

      if (rawSignals.length === 0) return { error: 'No signals provided' };

      const signals: Signal[] = rawSignals.map((s) => ({
        id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        symbol: s.symbol,
        direction: s.direction as Signal['direction'],
        strength: s.strength,
        source: s.source,
        metadata: {},
      }));

      const customWeights = input.weights as WeightedSource[] | undefined;
      const weights = customWeights ?? DEFAULT_SOURCE_WEIGHTS;
      const aggregated = aggregateSignals(signals, weights);

      if (!aggregated) return { result: { aggregated: null, message: 'No aggregatable signals' } };
      return {
        result: {
          direction: aggregated.direction,
          strength: aggregated.strength,
          signalCount: aggregated.metadata?.signalCount ?? signals.length,
          source: aggregated.source,
        },
      };
    }

    case 'weights': {
      return {
        result: {
          weights: DEFAULT_SOURCE_WEIGHTS.map((w) => ({ source: w.source, weight: w.weight })),
        },
      };
    }

    case 'loop_config': {
      return {
        result: {
          loopIntervalMs: DEFAULT_LOOP_CONFIG.loopIntervalMs,
          mirofishIntervalMs: DEFAULT_LOOP_CONFIG.mirofishIntervalMs,
          rebalanceIntervalMs: DEFAULT_LOOP_CONFIG.rebalanceIntervalMs,
          mode: DEFAULT_LOOP_CONFIG.mode,
          maxSignalsPerLoop: DEFAULT_LOOP_CONFIG.maxSignalsPerLoop,
          trackedSymbols: DEFAULT_LOOP_CONFIG.trackedSymbols,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Use: list, get, register, remove, aggregate_signals, weights, loop_config` };
  }
}

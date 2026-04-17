import {
  InstrumentRegistry,
  validateCandle,
  candleDirection,
  candleBodyRatio,
  calculateSpread,
  detectDataGap,
  normalizeCandle,
  type Timeframe,
  type AssetClass,
} from '@sven/trading-platform/market-data';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const registry = new InstrumentRegistry();

  switch (action) {
    case 'instruments': {
      const assetClass = input.asset_class as AssetClass | undefined;
      const instruments = assetClass ? registry.listByAssetClass(assetClass) : registry.listActive();
      return {
        result: {
          count: instruments.length,
          instruments: instruments.map((i) => ({
            symbol: i.symbol,
            baseAsset: i.baseAsset,
            quoteAsset: i.quoteAsset,
            assetClass: i.assetClass,
            exchange: i.exchange,
            pricePrecision: i.pricePrecision,
            isActive: i.isActive,
          })),
        },
      };
    }

    case 'candles': {
      const symbol = input.symbol as string;
      const timeframe = (input.timeframe as Timeframe) ?? '1h';
      if (!symbol) return { error: 'Missing symbol' };

      // In production reads from TimescaleDB; here we return sample data
      const now = Date.now();
      const sampleCandles = Array.from({ length: 5 }, (_, i) => {
        const base = 60000 + Math.random() * 2000;
        return normalizeCandle({
          time: now - (4 - i) * 3_600_000,
          symbol,
          exchange: 'binance',
          timeframe,
          open: base,
          high: base + Math.random() * 500,
          low: base - Math.random() * 500,
          close: base + (Math.random() - 0.5) * 400,
          volume: Math.floor(Math.random() * 10000),
        });
      });

      return {
        result: {
          symbol,
          timeframe,
          count: sampleCandles.length,
          candles: sampleCandles.map((c) => ({
            time: c.time.toISOString(),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
            direction: candleDirection(c),
            bodyRatio: candleBodyRatio(c).toFixed(3),
          })),
        },
      };
    }

    case 'orderbook': {
      const symbol = input.symbol as string;
      if (!symbol) return { error: 'Missing symbol' };

      // Sample orderbook
      const bids = Array.from({ length: 10 }, (_, i) => ({ price: 60000 - i * 10, quantity: Math.random() * 5 }));
      const asks = Array.from({ length: 10 }, (_, i) => ({ price: 60010 + i * 10, quantity: Math.random() * 5 }));
      const { spread, midPrice } = calculateSpread(bids, asks);

      return {
        result: {
          symbol,
          bids: bids.slice(0, 5),
          asks: asks.slice(0, 5),
          spread: spread.toFixed(2),
          midPrice: midPrice.toFixed(2),
          depth: { bidDepth: bids.length, askDepth: asks.length },
        },
      };
    }

    case 'validate': {
      const rawCandle = input as Record<string, unknown>;
      const candle = normalizeCandle({
        time: (rawCandle.time as number) ?? Date.now(),
        symbol: (rawCandle.symbol as string) ?? 'BTC/USDT',
        exchange: 'binance',
        timeframe: (rawCandle.timeframe as string) ?? '1h',
        open: (rawCandle.open as number) ?? 0,
        high: (rawCandle.high as number) ?? 0,
        low: (rawCandle.low as number) ?? 0,
        close: (rawCandle.close as number) ?? 0,
        volume: (rawCandle.volume as number) ?? 0,
      });
      const errors = validateCandle(candle);
      return { result: { valid: errors.length === 0, errors } };
    }

    case 'gap_detect': {
      const symbol = input.symbol as string;
      const timeframe = (input.timeframe as Timeframe) ?? '1h';
      if (!symbol) return { error: 'Missing symbol' };

      // In production detects gaps in TimescaleDB data
      return { result: { symbol, timeframe, gaps: [], message: 'Connect to TimescaleDB for live gap detection' } };
    }

    case 'sentiment': {
      const symbol = input.symbol as string;
      if (!symbol) return { error: 'Missing symbol' };
      return { result: { symbol, sources: ['reddit', 'x', 'news'], aggregatedScore: 0, message: 'Connect to sentiment pipeline for live scores' } };
    }

    default:
      return { error: `Unknown action "${action}". Use: instruments, candles, orderbook, validate, gap_detect, sentiment` };
  }
}

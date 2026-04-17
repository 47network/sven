// ---------------------------------------------------------------------------
// @sven/trading-platform — Market Data Pipeline
// ---------------------------------------------------------------------------
// Unified types for candles, ticks, orderbook, instruments, and sentiment.
// Normalization utilities for multi-source feeds.
// ---------------------------------------------------------------------------

/* ── Instrument & Exchange ─────────────────────────────────────────────── */

export type AssetClass = 'crypto' | 'equity' | 'forex' | 'commodity' | 'index';
export type Exchange = 'binance' | 'bybit' | 'polygon' | 'alphavantage' | 'coingecko' | 'fred' | 'internal';

export interface Instrument {
  symbol: string;            // e.g. 'BTC/USDT', 'AAPL', 'EUR/USD'
  baseAsset: string;
  quoteAsset: string;
  assetClass: AssetClass;
  exchange: Exchange;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: number;
  maxQuantity: number;
  tickSize: number;
  isActive: boolean;
}

/* ── Timeframes ────────────────────────────────────────────────────────── */

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

/* ── Candle (OHLCV) ───────────────────────────────────────────────────── */

export interface Candle {
  time: Date;
  symbol: string;
  exchange: Exchange;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  trades?: number;
}

/* ── Tick ───────────────────────────────────────────────────────────────── */

export interface Tick {
  time: Date;
  symbol: string;
  exchange: Exchange;
  price: number;
  quantity: number;
  side?: 'buy' | 'sell';
  tradeId?: string;
}

/* ── Orderbook ─────────────────────────────────────────────────────────── */

export interface OrderbookLevel {
  price: number;
  quantity: number;
}

export interface OrderbookSnapshot {
  time: Date;
  symbol: string;
  exchange: Exchange;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  spread: number;
  midPrice: number;
}

/* ── Sentiment ─────────────────────────────────────────────────────────── */

export type SentimentSource = 'reddit' | 'x' | 'news' | 'telegram' | 'discord';

export interface SentimentScore {
  time: Date;
  symbol: string;
  source: SentimentSource;
  score: number;        // -1.0 to 1.0
  volume: number;
  sampleSize: number;
}

/* ── Macro Indicators ──────────────────────────────────────────────────── */

export type MacroIndicator = 'fed_rate' | 'cpi' | 'gdp' | 'unemployment' | 'pmi' | 'consumer_confidence';

export interface MacroDataPoint {
  time: Date;
  indicator: MacroIndicator;
  value: number;
  previous?: number;
  forecast?: number;
  surprise?: number;     // actual - forecast
}

/* ── Data Connector ────────────────────────────────────────────────────── */

export type ConnectorStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface ConnectorHealth {
  exchange: Exchange;
  status: ConnectorStatus;
  lastMessageAt?: Date;
  messagesPerSecond: number;
  errorCount: number;
  reconnectCount: number;
}

/* ── Instrument Registry ───────────────────────────────────────────────── */

const BUILT_IN_INSTRUMENTS: Instrument[] = [
  { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 2, quantityPrecision: 6, minQuantity: 0.00001, maxQuantity: 9000, tickSize: 0.01, isActive: true },
  { symbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 2, quantityPrecision: 5, minQuantity: 0.0001, maxQuantity: 100000, tickSize: 0.01, isActive: true },
  { symbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 2, quantityPrecision: 3, minQuantity: 0.01, maxQuantity: 1000000, tickSize: 0.01, isActive: true },
  { symbol: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 2, quantityPrecision: 4, minQuantity: 0.001, maxQuantity: 100000, tickSize: 0.01, isActive: true },
  { symbol: 'XRP/USDT', baseAsset: 'XRP', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 4, quantityPrecision: 1, minQuantity: 1, maxQuantity: 10000000, tickSize: 0.0001, isActive: true },
  { symbol: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 4, quantityPrecision: 1, minQuantity: 1, maxQuantity: 10000000, tickSize: 0.0001, isActive: true },
  { symbol: 'DOGE/USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 5, quantityPrecision: 0, minQuantity: 1, maxQuantity: 100000000, tickSize: 0.00001, isActive: true },
  { symbol: 'AVAX/USDT', baseAsset: 'AVAX', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 2, quantityPrecision: 2, minQuantity: 0.01, maxQuantity: 1000000, tickSize: 0.01, isActive: true },
  { symbol: 'DOT/USDT', baseAsset: 'DOT', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 3, quantityPrecision: 2, minQuantity: 0.01, maxQuantity: 1000000, tickSize: 0.001, isActive: true },
  { symbol: 'LINK/USDT', baseAsset: 'LINK', quoteAsset: 'USDT', assetClass: 'crypto', exchange: 'binance', pricePrecision: 3, quantityPrecision: 2, minQuantity: 0.01, maxQuantity: 1000000, tickSize: 0.001, isActive: true },
];

export class InstrumentRegistry {
  private instruments: Map<string, Instrument> = new Map();

  constructor() {
    for (const inst of BUILT_IN_INSTRUMENTS) {
      this.instruments.set(inst.symbol, inst);
    }
  }

  get(symbol: string): Instrument | undefined {
    return this.instruments.get(symbol);
  }

  list(): Instrument[] {
    return [...this.instruments.values()];
  }

  listActive(): Instrument[] {
    return this.list().filter((i) => i.isActive);
  }

  listByAssetClass(assetClass: AssetClass): Instrument[] {
    return this.list().filter((i) => i.assetClass === assetClass);
  }

  add(instrument: Instrument): void {
    this.instruments.set(instrument.symbol, instrument);
  }

  deactivate(symbol: string): boolean {
    const inst = this.instruments.get(symbol);
    if (!inst) return false;
    inst.isActive = false;
    return true;
  }
}

/* ── Normalization Utilities ───────────────────────────────────────────── */

export function normalizeCandle(
  raw: {
    time: number | string | Date;
    symbol: string;
    exchange: string;
    timeframe: string;
    open: number | string;
    high: number | string;
    low: number | string;
    close: number | string;
    volume: number | string;
    quoteVolume?: number | string;
    trades?: number;
  },
): Candle {
  return {
    time: raw.time instanceof Date ? raw.time : new Date(raw.time),
    symbol: raw.symbol,
    exchange: raw.exchange as Exchange,
    timeframe: raw.timeframe as Timeframe,
    open: Number(raw.open),
    high: Number(raw.high),
    low: Number(raw.low),
    close: Number(raw.close),
    volume: Number(raw.volume),
    quoteVolume: raw.quoteVolume != null ? Number(raw.quoteVolume) : undefined,
    trades: raw.trades,
  };
}

export function validateCandle(candle: Candle): string[] {
  const errors: string[] = [];
  if (candle.high < candle.low) errors.push('high < low');
  if (candle.open < candle.low || candle.open > candle.high) errors.push('open outside high/low range');
  if (candle.close < candle.low || candle.close > candle.high) errors.push('close outside high/low range');
  if (candle.volume < 0) errors.push('negative volume');
  if (!isFinite(candle.open) || !isFinite(candle.close)) errors.push('non-finite price');
  return errors;
}

export function calculateSpread(bids: OrderbookLevel[], asks: OrderbookLevel[]): { spread: number; midPrice: number } {
  if (bids.length === 0 || asks.length === 0) return { spread: 0, midPrice: 0 };
  const bestBid = bids[0]!.price;
  const bestAsk = asks[0]!.price;
  return {
    spread: bestAsk - bestBid,
    midPrice: (bestBid + bestAsk) / 2,
  };
}

export function candleBodyRatio(candle: Candle): number {
  const range = candle.high - candle.low;
  if (range === 0) return 0;
  return Math.abs(candle.close - candle.open) / range;
}

export function candleDirection(candle: Candle): 'bullish' | 'bearish' | 'neutral' {
  if (candle.close > candle.open) return 'bullish';
  if (candle.close < candle.open) return 'bearish';
  return 'neutral';
}

export function detectDataGap(candles: Candle[], timeframe: Timeframe): { from: Date; to: Date }[] {
  const gaps: { from: Date; to: Date }[] = [];
  const expectedMs = TIMEFRAME_MS[timeframe];
  const tolerance = expectedMs * 1.5;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!;
    const curr = candles[i]!;
    const diff = curr.time.getTime() - prev.time.getTime();
    if (diff > tolerance) {
      gaps.push({ from: prev.time, to: curr.time });
    }
  }
  return gaps;
}

/* ── Data Retention Policy ─────────────────────────────────────────────── */

export interface RetentionPolicy {
  dataType: string;
  hotDays: number;
  warmDays: number;
  coldDays: number | null; // null = archive forever
}

export const DEFAULT_RETENTION: RetentionPolicy[] = [
  { dataType: 'ticks', hotDays: 7, warmDays: 90, coldDays: null },
  { dataType: 'candles_1m', hotDays: 30, warmDays: 365, coldDays: null },
  { dataType: 'candles_5m+', hotDays: 365, warmDays: -1, coldDays: null },
  { dataType: 'orderbook', hotDays: 3, warmDays: 30, coldDays: null },
  { dataType: 'sentiment', hotDays: 30, warmDays: 365, coldDays: null },
  { dataType: 'macro', hotDays: -1, warmDays: -1, coldDays: null },
];

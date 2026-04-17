import type { Candle, Timeframe } from '@sven/trading-platform/market-data';

export const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT', 'ETH/USDT': 'ETHUSDT', 'SOL/USDT': 'SOLUSDT',
  'BNB/USDT': 'BNBUSDT', 'XRP/USDT': 'XRPUSDT',
};

// Binance kline interval map: our timeframe → Binance interval string
const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
};

function parseBinanceKlines(raw: unknown[][], binanceSymbol: string, interval: string): Candle[] {
  return raw.map((k) => ({
    time: new Date(k[0] as number),
    symbol: binanceSymbol,
    exchange: 'binance' as const,
    timeframe: interval as Timeframe,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

export async function fetchBinanceCandles(binanceSymbol: string, interval = '1h', limit = 100): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return parseBinanceKlines(raw, binanceSymbol, interval);
}

/**
 * Fetch extended historical candles from Binance by paginating backwards.
 * Binance limits klines to 1000 per request. This function chains requests
 * to fetch up to `totalBars` candles for backtesting.
 * Returns candles in chronological order (oldest first).
 */
export async function fetchBinanceHistoricalCandles(
  binanceSymbol: string,
  interval = '1h',
  totalBars = 1000,
): Promise<Candle[]> {
  const resolvedInterval = BINANCE_INTERVAL_MAP[interval] ?? interval;
  const maxPerReq = 1000;
  const allCandles: Candle[] = [];
  let endTime: number | undefined;

  while (allCandles.length < totalBars) {
    const limit = Math.min(maxPerReq, totalBars - allCandles.length);
    let url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(resolvedInterval)}&limit=${limit}`;
    if (endTime != null) url += `&endTime=${endTime}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance historical klines ${res.status}`);
    const raw = (await res.json()) as unknown[][];
    if (raw.length === 0) break;

    const candles = parseBinanceKlines(raw, binanceSymbol, resolvedInterval);
    allCandles.unshift(...candles);

    // Next page: go back before the earliest candle we just got
    const earliestOpenTime = raw[0][0] as number;
    endTime = earliestOpenTime - 1;

    if (raw.length < limit) break; // no more data available
  }

  // Trim to requested count (take the most recent `totalBars` candles)
  return allCandles.slice(-totalBars);
}

export async function fetchBinancePrice(binanceSymbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance price ${res.status}`);
  const data = (await res.json()) as { price: string };
  return parseFloat(data.price);
}

export async function validateBinanceSymbol(binanceSymbol: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(binanceSymbol)}`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

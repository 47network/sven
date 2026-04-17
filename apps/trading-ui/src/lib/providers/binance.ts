/* ── Binance Public API (no API key required) ────────────── */
import type { Candle, TickerData, WatchlistItem } from '../types';

const REST_BASE = 'https://api.binance.com';

/**
 * Fetch OHLCV candles from Binance.
 * @see https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
export async function fetchBinanceCandles(
  symbol: string,
  interval: string,
  limit = 300,
): Promise<Candle[]> {
  const url = `${REST_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 10 } });
  if (!res.ok) throw new Error(`Binance klines ${res.status}: ${await res.text()}`);

  const raw: unknown[][] = await res.json();
  return raw.map((k) => ({
    timestamp: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

/**
 * Fetch 24hr ticker stats from Binance for a single symbol.
 */
export async function fetchBinanceTicker(symbol: string): Promise<TickerData> {
  const url = `${REST_BASE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`Binance ticker ${res.status}: ${await res.text()}`);

  const d = await res.json();
  return {
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    bid: parseFloat(d.bidPrice),
    ask: parseFloat(d.askPrice),
    change24h: parseFloat(d.priceChange),
    changePct: parseFloat(d.priceChangePercent),
    volume: parseFloat(d.volume),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
    timestamp: d.closeTime,
  };
}

/**
 * Fetch 24hr tickers for multiple Binance symbols at once.
 */
export async function fetchBinanceTickers(symbols: string[]): Promise<TickerData[]> {
  const param = JSON.stringify(symbols);
  const url = `${REST_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(param)}`;
  const res = await fetch(url, { next: { revalidate: 5 } });
  if (!res.ok) throw new Error(`Binance tickers ${res.status}: ${await res.text()}`);

  const arr: Array<Record<string, string | number>> = await res.json();
  return arr.map((d) => ({
    symbol: d.symbol as string,
    price: parseFloat(d.lastPrice as string),
    bid: parseFloat(d.bidPrice as string),
    ask: parseFloat(d.askPrice as string),
    change24h: parseFloat(d.priceChange as string),
    changePct: parseFloat(d.priceChangePercent as string),
    volume: parseFloat(d.volume as string),
    high: parseFloat(d.highPrice as string),
    low: parseFloat(d.lowPrice as string),
    timestamp: d.closeTime as number,
  }));
}

/**
 * Convert a Binance ticker into our WatchlistItem format.
 */
export function binanceTickerToWatchlistItem(
  t: TickerData,
  displaySymbol: string,
  name: string,
): WatchlistItem {
  return {
    symbol: displaySymbol,
    name,
    price: t.price,
    change24h: t.change24h,
    changePct: t.changePct,
    volume24h: t.volume * t.price,
    high24h: t.high,
    low24h: t.low,
  };
}

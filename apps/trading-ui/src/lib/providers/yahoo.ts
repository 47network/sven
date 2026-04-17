/* ── Yahoo Finance (server-side proxy — no API key for chart data) ── */
import type { Candle, WatchlistItem } from '../types';

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        currency: string;
        symbol: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Fetch OHLCV candles from Yahoo Finance.
 * Runs server-side (Next.js API route) to avoid CORS.
 */
export async function fetchYahooCandles(
  symbol: string,
  interval: string,
  range: string,
): Promise<Candle[]> {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SvenTrading/1.0)',
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}: ${await res.text()}`);

  const data: YahooChartResponse = await res.json();
  if (data.chart.error) throw new Error(`Yahoo error: ${data.chart.error.description}`);

  const result = data.chart.result?.[0];
  if (!result || !result.timestamp) return [];

  const { timestamp } = result;
  const quote = result.indicators.quote[0];
  const candles: Candle[] = [];

  for (let i = 0; i < timestamp.length; i++) {
    if (quote.open[i] == null || quote.close[i] == null) continue;
    candles.push({
      timestamp: timestamp[i] * 1000,
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i] ?? 0,
    });
  }

  return candles;
}

/**
 * Fetch a quick quote from Yahoo Finance for watchlist display.
 */
export async function fetchYahooQuote(symbol: string): Promise<{
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
} | null> {
  const url = `${CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2d&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SvenTrading/1.0)',
    },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;

  const data: YahooChartResponse = await res.json();
  const result = data.chart.result?.[0];
  if (!result) return null;

  const { meta } = result;
  const quote = result.indicators.quote[0];
  const lastIdx = (result.timestamp?.length ?? 1) - 1;

  const price = meta.regularMarketPrice ?? 0;
  const previousClose = meta.previousClose ?? price;
  const change = price - previousClose;
  const changePct = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    price,
    previousClose,
    change,
    changePct,
    high: quote.high?.[lastIdx] ?? price,
    low: quote.low?.[lastIdx] ?? price,
    volume: quote.volume?.[lastIdx] ?? 0,
  };
}

/**
 * Convert Yahoo quote to WatchlistItem.
 */
export function yahooQuoteToWatchlistItem(
  quote: NonNullable<Awaited<ReturnType<typeof fetchYahooQuote>>>,
  displaySymbol: string,
  name: string,
): WatchlistItem {
  return {
    symbol: displaySymbol,
    name,
    price: quote.price,
    change24h: quote.change,
    changePct: quote.changePct,
    volume24h: quote.volume * quote.price,
    high24h: quote.high,
    low24h: quote.low,
  };
}

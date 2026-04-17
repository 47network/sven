/* ── GET /api/market/watchlist — All symbols with live prices ── */
import { NextResponse } from 'next/server';
import { SYMBOL_REGISTRY } from '@/lib/providers/symbols';
import { fetchBinanceTickers, binanceTickerToWatchlistItem } from '@/lib/providers/binance';
import { fetchYahooQuote, yahooQuoteToWatchlistItem } from '@/lib/providers/yahoo';
import type { WatchlistItem } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items: WatchlistItem[] = [];

  /* ── Batch-fetch all Binance symbols at once ────────────── */
  const binanceSymbols = SYMBOL_REGISTRY.filter((s) => s.provider === 'binance');
  const yahooSymbols = SYMBOL_REGISTRY.filter((s) => s.provider === 'yahoo');

  try {
    const binanceTickers = await fetchBinanceTickers(
      binanceSymbols.map((s) => s.providerSymbol),
    );

    for (const ticker of binanceTickers) {
      const config = binanceSymbols.find((s) => s.providerSymbol === ticker.symbol);
      if (config) {
        items.push(binanceTickerToWatchlistItem(ticker, config.symbol, config.name));
      }
    }
  } catch {
    /* Binance unavailable — skip crypto symbols */
  }

  /* ── Fetch Yahoo symbols individually (they don't have a batch endpoint) ── */
  const yahooResults = await Promise.allSettled(
    yahooSymbols.map(async (config) => {
      const quote = await fetchYahooQuote(config.providerSymbol);
      if (quote) {
        return yahooQuoteToWatchlistItem(quote, config.symbol, config.name);
      }
      return null;
    }),
  );

  for (const result of yahooResults) {
    if (result.status === 'fulfilled' && result.value) {
      items.push(result.value);
    }
  }

  /* Preserve registry order */
  const ordered = SYMBOL_REGISTRY
    .map((s) => items.find((i) => i.symbol === s.symbol))
    .filter((i): i is WatchlistItem => i != null);

  return NextResponse.json(ordered);
}

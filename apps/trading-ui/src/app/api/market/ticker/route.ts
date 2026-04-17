/* ── GET /api/market/ticker?symbol=BTC/USDT ─────────────── */
import { NextRequest, NextResponse } from 'next/server';
import { getSymbolConfig } from '@/lib/providers/symbols';
import { fetchBinanceTicker } from '@/lib/providers/binance';
import { fetchYahooQuote } from '@/lib/providers/yahoo';
import type { TickerData } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const config = getSymbolConfig(symbol);
  if (!config) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  try {
    let ticker: TickerData;

    if (config.provider === 'binance') {
      const raw = await fetchBinanceTicker(config.providerSymbol);
      ticker = { ...raw, symbol: config.symbol };
    } else {
      const quote = await fetchYahooQuote(config.providerSymbol);
      if (!quote) {
        return NextResponse.json({ error: 'Quote unavailable' }, { status: 502 });
      }
      ticker = {
        symbol: config.symbol,
        price: quote.price,
        bid: quote.price,
        ask: quote.price,
        change24h: quote.change,
        changePct: quote.changePct,
        volume: quote.volume,
        high: quote.high,
        low: quote.low,
        timestamp: Date.now(),
      };
    }

    return NextResponse.json(ticker);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

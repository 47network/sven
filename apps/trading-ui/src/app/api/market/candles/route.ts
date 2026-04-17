/* ── GET /api/market/candles?symbol=BTC/USDT&tf=15m&limit=300 ── */
import { NextRequest, NextResponse } from 'next/server';
import { getSymbolConfig, toBinanceInterval, toYahooParams } from '@/lib/providers/symbols';
import { fetchBinanceCandles } from '@/lib/providers/binance';
import { fetchYahooCandles } from '@/lib/providers/yahoo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get('symbol');
  const tf = searchParams.get('tf') ?? '15m';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '300', 10), 1000);

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const config = getSymbolConfig(symbol);
  if (!config) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  try {
    let candles;

    if (config.provider === 'binance') {
      const interval = toBinanceInterval(tf);
      candles = await fetchBinanceCandles(config.providerSymbol, interval, limit);
    } else {
      const { range, interval } = toYahooParams(tf);
      candles = await fetchYahooCandles(config.providerSymbol, interval, range);
    }

    return NextResponse.json({
      symbol: config.symbol,
      provider: config.provider,
      timeframe: tf,
      count: candles.length,
      candles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

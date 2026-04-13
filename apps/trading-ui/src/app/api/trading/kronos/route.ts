/* ── POST /api/trading/kronos — Run Kronos BSQ prediction server-side ── */
import { NextRequest, NextResponse } from 'next/server';
import { runKronosPipeline } from '@sven/trading-platform/autonomous';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { symbol, candles, current_price } = await req.json();

    if (!symbol || !Array.isArray(candles) || !current_price) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'symbol, candles, and current_price required' } },
        { status: 400 },
      );
    }

    const result = runKronosPipeline(symbol, candles, current_price);
    return NextResponse.json({ success: true, data: result.prediction });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kronos prediction failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
}

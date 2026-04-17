/* ── POST /api/trading/mirofish — Run MiroFish simulation server-side ── */
import { NextRequest, NextResponse } from 'next/server';
import { runMiroFishSimulation } from '@sven/trading-platform/autonomous';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { symbol, candles, agent_count = 1000, timesteps = 100 } = await req.json();

    if (!symbol || !Array.isArray(candles)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'symbol and candles array required' } },
        { status: 400 },
      );
    }

    const result = runMiroFishSimulation(symbol, candles, agent_count, timesteps);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MiroFish simulation failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
}

'use client';

/* ── Trading Dashboard — Main Page ───────────────────────── */
import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Chart } from '@/components/Chart';
import { BottomPanel } from '@/components/BottomPanel';
import { RightPanel } from '@/components/RightPanel';
import { KronosPanel } from '@/components/KronosPanel';
import { MiroFishPanel } from '@/components/MiroFishPanel';
import { SvenBrainPanel } from '@/components/SvenBrainPanel';
import { NewsPipelinePanel } from '@/components/NewsPipelinePanel';
import { OrderTicket } from '@/components/OrderTicket';
import { useLivePrice, usePolledPrice } from '@/lib/hooks/use-live-price';
import { useCandles, useWatchlist } from '@/lib/hooks/use-market-data';
import { useTradingEvents } from '@/lib/hooks/use-trading-events';
import { useTradingStore } from '@/lib/store';
import {
  fetchOrders, fetchPositions, fetchPredictions, fetchNewsEvents,
} from '@/lib/api';
import {
  getPositions, getOrders, getRecentSignals,
  getRecentPredictions, getRecentNews, getRecentActivities,
} from '@/lib/mock-data';

/**
 * LiveDataConnector — connects all real-time data sources.
 * Tries gateway API first; falls back to demo data when unavailable.
 */
function LiveDataConnector() {
  /* Real market data from Binance WebSocket + REST */
  useLivePrice();
  usePolledPrice();
  useCandles();
  useWatchlist();

  /* SSE connection to Sven's autonomous trading engine */
  useTradingEvents();

  /* Load Sven's internal trading data — gateway-first, fallback to demo */
  const setPositions = useTradingStore((s) => s.setPositions);
  const setOrders = useTradingStore((s) => s.setOrders);
  const setSignals = useTradingStore((s) => s.setSignals);
  const setPredictions = useTradingStore((s) => s.setPredictions);
  const setNewsItems = useTradingStore((s) => s.setNewsItems);
  const addActivity = useTradingStore((s) => s.addActivity);

  const loadTradingData = useCallback(async () => {
    /* Positions — try gateway, fallback to demo */
    try {
      const res = await fetchPositions();
      const positions = (res as any)?.data ?? res;
      if (Array.isArray(positions) && positions.length > 0) {
        setPositions(positions.map((p: any) => ({
          symbol: p.symbol,
          side: p.side === 'long' ? 'buy' : p.side === 'short' ? 'sell' : p.side,
          quantity: Number(p.quantity),
          entryPrice: Number(p.entryPrice ?? p.avg_entry_price ?? 0),
          currentPrice: Number(p.currentPrice ?? p.current_price ?? 0),
          openedAt: new Date(p.openedAt ?? p.opened_at).getTime(),
          lastUpdateAt: Date.now(),
          realizedPnl: 0,
          commission: 0,
          orderId: p.id ?? '',
        })));
      } else {
        setPositions(getPositions());
      }
    } catch {
      setPositions(getPositions());
    }

    /* Orders — try gateway, fallback to demo */
    try {
      const res = await fetchOrders();
      const orders = (res as any)?.data ?? res;
      if (Array.isArray(orders) && orders.length > 0) {
        setOrders(orders.map((o: any) => ({
          id: o.id,
          symbol: o.symbol,
          side: o.side,
          type: o.type,
          quantity: Number(o.quantity),
          price: o.price ? Number(o.price) : undefined,
          status: o.status,
          filledAt: o.filled_at ? new Date(o.filled_at).getTime() : undefined,
          createdAt: new Date(o.created_at).getTime(),
        })));
      } else {
        setOrders(getOrders());
      }
    } catch {
      setOrders(getOrders());
    }

    /* Predictions — try gateway, fallback to demo */
    try {
      const res = await fetchPredictions();
      const preds = (res as any)?.data ?? res;
      if (Array.isArray(preds) && preds.length > 0) {
        setPredictions(preds.map((p: any) => {
          const pred = typeof p.prediction === 'string' ? JSON.parse(p.prediction) : (p.prediction ?? {});
          return {
            id: p.id,
            createdAt: new Date(p.createdAt ?? p.created_at).getTime(),
            model: pred.model ?? 'kronos_v1',
            symbol: p.symbol,
            exchange: pred.exchange ?? 'default',
            timeframe: p.horizon ?? pred.timeframe ?? '1h',
            horizonCandles: pred.horizonCandles ?? 4,
            predictedClose: pred.predictedClose ?? 0,
            predictedDirection: pred.predictedDirection ?? 'neutral',
            confidence: pred.confidence ?? 0.5,
          };
        }));
      } else {
        setPredictions(getRecentPredictions());
      }
    } catch {
      setPredictions(getRecentPredictions());
    }

    /* News — try gateway, fallback to demo */
    try {
      const res = await fetchNewsEvents();
      const news = (res as any)?.data ?? res;
      if (Array.isArray(news) && news.length > 0) {
        setNewsItems(news.map((n: any) => ({
          event: n.event ?? n.headline ?? '',
          sentimentScore: Number(n.sentimentScore ?? n.sentiment_score ?? 0),
          impact: {
            level: Number(n.impactLevel ?? n.impact_level ?? 1),
            category: (typeof n.entities === 'object' && n.entities?.events?.[0]) || 'general',
          },
          entities: typeof n.entities === 'object' ? n.entities : { symbols: [], sectors: [], events: [] },
          isDuplicate: false,
          timestamp: new Date(n.createdAt ?? n.created_at).getTime(),
        })));
      } else {
        setNewsItems(getRecentNews());
      }
    } catch {
      setNewsItems(getRecentNews());
    }

    /* Signals — no GET endpoint, always use demo for now */
    setSignals(getRecentSignals());

    /* Activity feed — populated via SSE in production, seed with demo */
    const activities = getRecentActivities();
    for (const a of activities) {
      addActivity(a);
    }
  }, [setPositions, setOrders, setSignals, setPredictions, setNewsItems, addActivity]);

  useEffect(() => {
    loadTradingData();
    /* Refresh trading data every 30s */
    const interval = setInterval(loadTradingData, 30_000);
    return () => clearInterval(interval);
  }, [loadTradingData]);

  return null;
}

export default function TradingPage() {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const ticker = useTradingStore((s) => s.ticker);
  const newsItems = useTradingStore((s) => s.newsItems);
  const [orderTicketOpen, setOrderTicketOpen] = useState(false);

  /* Kronos + MiroFish prediction state — auto-triggered when candles load */
  const candles = useTradingStore((s) => s.candles);
  const [kronosPrediction, setKronosPrediction] = useState<any>(null);
  const [mirofishResult, setMirofishResult] = useState<any>(null);

  /* Auto-run Kronos + MiroFish when we have enough candle data */
  useEffect(() => {
    if (candles.length < 20) return;

    const payload = {
      symbol: activeSymbol,
      candles: candles.map((c: any) => ({
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume, timestamp: c.time ?? c.timestamp,
      })),
      current_price: ticker?.price ?? candles[candles.length - 1]?.close ?? 0,
    };

    fetch('/api/trading/kronos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setKronosPrediction(j.data); })
      .catch(() => {});

    fetch('/api/trading/mirofish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((j) => { if (j.success) setMirofishResult(j.data); })
      .catch(() => {});
  // Re-run when active symbol changes or candles cross the threshold
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol, candles.length >= 20]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <LiveDataConnector />
      <Header onTrade={() => setOrderTicketOpen(true)} />
      <OrderTicket open={orderTicketOpen} onClose={() => setOrderTicketOpen(false)} />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex flex-col flex-1 min-w-0 min-h-0">
          <Chart />
          <BottomPanel />
        </main>
        {/* Right panel: Sven Brain → Kronos → MiroFish → Portfolio */}
        <aside className="w-80 border-l border-surface-700 overflow-y-auto flex flex-col gap-2 p-2 bg-surface-900/50">
          <SvenBrainPanel />
          <KronosPanel
            prediction={kronosPrediction}
            currentPrice={ticker?.price ?? 0}
            symbol={activeSymbol}
          />
          <MiroFishPanel
            result={mirofishResult}
            symbol={activeSymbol}
          />
          <NewsPipelinePanel newsItems={newsItems} />
        </aside>
      </div>
    </div>
  );
}

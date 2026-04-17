'use client';

/* ── Live Binance WebSocket for real-time price updates ──── */
import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '@/lib/store';
import { getSymbolConfig } from '@/lib/providers/symbols';
import type { Candle, TickerData } from '@/lib/types';

const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

interface BinanceTickerMsg {
  e: '24hrTicker';
  s: string;       /* BTCUSDT */
  c: string;       /* last price */
  b: string;       /* best bid */
  a: string;       /* best ask */
  p: string;       /* price change */
  P: string;       /* price change % */
  h: string;       /* high */
  l: string;       /* low */
  v: string;       /* volume (base) */
  E: number;       /* event time */
}

interface BinanceKlineMsg {
  e: 'kline';
  s: string;
  k: {
    t: number;     /* open time */
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    x: boolean;    /* is kline closed? */
  };
}

/**
 * Hook that opens a Binance WebSocket for the active symbol,
 * streaming live ticker + kline updates into the Zustand store.
 *
 * Only activates for Binance-backed symbols.
 * For Yahoo symbols, falls back to polling.
 */
export function useLivePrice() {
  const wsRef = useRef<WebSocket | null>(null);
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const activeTimeframe = useTradingStore((s) => s.activeTimeframe);
  const setTicker = useTradingStore((s) => s.setTicker);
  const addCandle = useTradingStore((s) => s.addCandle);

  /* Map timeframe to Binance interval */
  const tfMap: Record<string, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m',
    '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w',
  };

  const connect = useCallback(() => {
    const config = getSymbolConfig(activeSymbol);
    if (!config || config.provider !== 'binance' || !config.wsStream) return;

    /* Close previous connection */
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const stream = config.wsStream;
    const interval = tfMap[activeTimeframe] ?? '15m';
    const url = `${BINANCE_WS}/${stream}@ticker/${stream}@kline_${interval}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.e === '24hrTicker') {
          const t = msg as BinanceTickerMsg;
          const ticker: TickerData = {
            symbol: activeSymbol,
            price: parseFloat(t.c),
            bid: parseFloat(t.b),
            ask: parseFloat(t.a),
            change24h: parseFloat(t.p),
            changePct: parseFloat(t.P),
            volume: parseFloat(t.v),
            high: parseFloat(t.h),
            low: parseFloat(t.l),
            timestamp: t.E,
          };
          setTicker(ticker);
        }

        if (msg.e === 'kline') {
          const k = (msg as BinanceKlineMsg).k;
          if (k.x) {
            /* Closed candle — add to chart */
            const candle: Candle = {
              timestamp: k.t,
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
            };
            addCandle(candle);
          }
        }
      } catch {
        /* Ignore malformed messages */
      }
    };

    ws.onerror = () => {
      /* Will auto-reconnect on close */
    };

    ws.onclose = () => {
      /* Reconnect after 3 seconds */
      setTimeout(() => {
        if (wsRef.current === ws) {
          connect();
        }
      }, 3000);
    };
  }, [activeSymbol, activeTimeframe, setTicker, addCandle]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}

/**
 * Hook that polls ticker for Yahoo-backed symbols
 * (no WebSocket available for free).
 */
export function usePolledPrice() {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const setTicker = useTradingStore((s) => s.setTicker);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const config = getSymbolConfig(activeSymbol);
    if (!config || config.provider === 'binance') return;

    /* Poll every 15 seconds for Yahoo-backed symbols */
    const poll = async () => {
      try {
        const res = await fetch(`/api/market/ticker?symbol=${encodeURIComponent(activeSymbol)}`);
        if (res.ok) {
          const ticker = await res.json();
          setTicker(ticker);
        }
      } catch {
        /* Silently retry next interval */
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 15_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeSymbol, setTicker]);
}

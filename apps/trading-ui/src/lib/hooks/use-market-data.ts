'use client';

/* ── Hooks to fetch candles and watchlist from our API routes ── */
import { useEffect, useCallback } from 'react';
import { useTradingStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import type { Candle, WatchlistItem } from '@/lib/types';

/**
 * Fetch historical candles when symbol or timeframe changes.
 */
export function useCandles() {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const activeTimeframe = useTradingStore((s) => s.activeTimeframe);
  const setCandles = useTradingStore((s) => s.setCandles);

  const { data, isLoading, error } = useQuery({
    queryKey: ['candles', activeSymbol, activeTimeframe],
    queryFn: async (): Promise<Candle[]> => {
      const res = await fetch(
        `/api/market/candles?symbol=${encodeURIComponent(activeSymbol)}&tf=${activeTimeframe}&limit=300`,
      );
      if (!res.ok) throw new Error(`Failed to fetch candles: ${res.status}`);
      const json = await res.json();
      return json.candles;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (data) {
      setCandles(data);
    }
  }, [data, setCandles]);

  return { isLoading, error };
}

/**
 * Fetch watchlist with real prices from all providers.
 */
export function useWatchlist() {
  const setWatchlist = useTradingStore((s) => s.setWatchlist);

  const { data, isLoading, error } = useQuery({
    queryKey: ['watchlist'],
    queryFn: async (): Promise<WatchlistItem[]> => {
      const res = await fetch('/api/market/watchlist');
      if (!res.ok) throw new Error(`Failed to fetch watchlist: ${res.status}`);
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (data) {
      setWatchlist(data);
    }
  }, [data, setWatchlist]);

  return { isLoading, error };
}

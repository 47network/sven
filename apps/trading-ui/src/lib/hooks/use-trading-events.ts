// ---------------------------------------------------------------------------
// SSE Hook — Live trading events from Sven's autonomous engine
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTradingStore } from '../store';

export type TradingEventType =
  | 'state_change'
  | 'signal_generated'
  | 'decision_made'
  | 'order_placed'
  | 'order_filled'
  | 'position_opened'
  | 'position_closed'
  | 'risk_alert'
  | 'circuit_breaker'
  | 'prediction_ready'
  | 'news_impact'
  | 'portfolio_update'
  | 'learning_update'
  | 'market_data'
  | 'trade_executed'
  | 'sven_message'
  | 'activity';

export interface TradingEvent {
  id: string;
  type: TradingEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Connects to the gateway SSE stream at /v1/trading/events.
 * Dispatches events to the Zustand store for real-time UI updates.
 */
export function useTradingEvents() {
  const esRef = useRef<EventSource | null>(null);
  const store = useTradingStore();

  const connect = useCallback(() => {
    if (esRef.current) return;

    const url = `${API_BASE}/v1/trading/events`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const event: TradingEvent = JSON.parse(msg.data);
        handleEvent(event);
      } catch {
        // Ignore malformed messages
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvent = useCallback((event: TradingEvent) => {
    const state = useTradingStore.getState();
    const ts = new Date(event.timestamp).getTime();

    switch (event.type) {
      case 'state_change':
        state.addActivity({
          id: event.id,
          type: 'strategy',
          message: `Sven → ${event.data.state as string} (${event.data.phase ?? event.data.symbol ?? ''})`,
          timestamp: ts,
        });
        break;

      case 'signal_generated':
        state.addSignal({
          id: event.id,
          symbol: event.data.symbol as string,
          direction: (event.data.direction as 'long' | 'short' | 'neutral') ?? 'neutral',
          strength: event.data.strength as number,
          source: event.data.source as string,
          timestamp: ts,
        });
        break;

      case 'decision_made':
        state.addActivity({
          id: event.id,
          type: 'strategy',
          message: `Decision: ${event.data.type} ${event.data.symbol ?? ''} — ${event.data.reason ?? event.data.reasoning ?? ''}`,
          timestamp: ts,
        });
        break;

      case 'order_placed':
        state.addActivity({
          id: event.id,
          type: 'order',
          message: `Order placed: ${event.data.side} ${event.data.quantity} ${event.data.symbol} (${event.data.exchange})`,
          timestamp: ts,
        });
        break;

      case 'trade_executed':
        state.addActivity({
          id: event.id,
          type: 'order',
          message: `🤖 SVEN AUTO-TRADE: ${event.data.side} ${event.data.quantity} ${event.data.symbol} @ $${Number(event.data.price).toLocaleString()} (${((event.data.confidence as number) * 100).toFixed(0)}% confidence)`,
          timestamp: ts,
        });
        break;

      case 'sven_message':
        state.addActivity({
          id: event.id,
          type: 'strategy',
          message: `💬 Sven: ${event.data.title} — ${(event.data.body as string).slice(0, 150)}`,
          timestamp: ts,
        });
        break;

      case 'prediction_ready':
        state.addPrediction({
          id: event.id,
          symbol: (event.data.symbol as string) ?? '',
          model: (event.data.model as string) ?? 'kronos',
          exchange: (event.data.exchange as string) ?? 'paper',
          timeframe: (event.data.timeframe as string) ?? '1h',
          horizonCandles: (event.data.horizonCandles as number) ?? 24,
          predictedClose: (event.data.predictedClose as number) ?? 0,
          predictedDirection: (event.data.predictedDirection as 'long' | 'short' | 'neutral') ?? 'neutral',
          confidence: (event.data.confidence as number) ?? 0,
          createdAt: ts,
        });
        break;

      case 'news_impact':
        state.addNewsItem({
          event: (event.data.headline as string) ?? (event.data.event as string) ?? 'Unknown event',
          sentimentScore: (event.data.sentiment as number) ?? 0,
          impact: {
            level: (event.data.impactLevel as number) ?? 0,
            category: (event.data.category as string) ?? 'general',
          },
          entities: {
            symbols: (event.data.symbols as string[]) ?? [],
            sectors: (event.data.sectors as string[]) ?? [],
            events: (event.data.events as string[]) ?? [],
          },
          isDuplicate: false,
          timestamp: ts,
        });
        break;

      case 'risk_alert':
        state.addActivity({
          id: event.id,
          type: 'risk_check',
          message: `Risk alert: ${(event.data.failedChecks as string[])?.join(', ') ?? 'Unknown'}`,
          timestamp: ts,
        });
        break;

      case 'circuit_breaker':
        state.addActivity({
          id: event.id,
          type: 'risk_check',
          message: `Circuit breaker ${event.data.action}: ${event.data.reason ?? 'manual reset'}`,
          timestamp: ts,
        });
        break;

      case 'learning_update':
        state.addActivity({
          id: event.id,
          type: 'prediction',
          message: `Learning: weights adjusted (iteration ${event.data.iteration})`,
          timestamp: ts,
        });
        break;

      default:
        state.addActivity({
          id: event.id,
          type: 'strategy',
          message: `[${event.type}] ${JSON.stringify(event.data).slice(0, 100)}`,
          timestamp: ts,
        });
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}

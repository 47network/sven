'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import { setRuntimeHealth } from '@/lib/store';

/**
 * Connects to the SSE stream at /api/v1/stream for realtime updates.
 * Invalidates relevant React Query caches when new events arrive.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const normalizedPathname = pathname || '/';
  const isPublicCommunity = normalizedPathname === '/community' || normalizedPathname.startsWith('/community/');
  const isLoginRoute = normalizedPathname === '/login' || normalizedPathname.startsWith('/login/');
  const isSharedRoute = normalizedPathname === '/shared' || normalizedPathname.startsWith('/shared/');
  const realtimeDisabled = isPublicCommunity || isLoginRoute || isSharedRoute;

  useEffect(() => {
    if (realtimeDisabled) {
      const message = isPublicCommunity
        ? 'Realtime stream disabled for public community page.'
        : isLoginRoute
          ? 'Realtime stream idle until login.'
          : 'Realtime stream disabled on shared transcript pages.';
      setRuntimeHealth({ health: 'degraded', source: 'sse', message });
      return () => undefined;
    }

    let cancelled = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    async function connect() {
      if (cancelled) return;
      try {
        await api.me.get();
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setRuntimeHealth({ health: 'offline', source: 'sse', message: 'Realtime stream idle until login.' });
          clearReconnectTimer();
          reconnectTimerRef.current = window.setTimeout(connect, 30000);
          return;
        }
      }

      const es = new EventSource('/api/v1/stream', { withCredentials: true });
      esRef.current = es;
      es.onopen = () => {
        clearReconnectTimer();
        setRuntimeHealth({ health: 'online', source: 'sse', message: 'Realtime stream connected.' });
      };

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.chat_id) {
            qc.invalidateQueries({ queryKey: ['messages', data.chat_id] });
            qc.invalidateQueries({ queryKey: ['canvas', data.chat_id] });
          }
          qc.invalidateQueries({ queryKey: ['chats'] });
        } catch (err) {
          void err;
        }
      });

      es.addEventListener('approval', () => {
        qc.invalidateQueries({ queryKey: ['approvals'] });
      });

      const onAgentState = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const chatId = String(data?.chat_id || '').trim();
          if (!chatId) return;
          qc.invalidateQueries({ queryKey: ['agent-state', chatId] });
        } catch (err) {
          void err;
        }
      };
      es.addEventListener('agent.paused', onAgentState as EventListener);
      es.addEventListener('agent.resumed', onAgentState as EventListener);
      es.addEventListener('agent.nudged', onAgentState as EventListener);

      es.onerror = () => {
        if (cancelled) return;
        setRuntimeHealth({ health: 'degraded', source: 'sse', message: 'Realtime stream reconnecting.' });
        es.close();
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearReconnectTimer();
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isLoginRoute, isPublicCommunity, isSharedRoute, qc, realtimeDisabled]);

  return <>{children}</>;
}

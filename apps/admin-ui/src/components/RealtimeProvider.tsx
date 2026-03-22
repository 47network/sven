'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { setRuntimeHealth } from '@/lib/store';
import { ApiError, api } from '@/lib/api';

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: unknown;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  lastEvent: null,
});

const ADMIN_BASE_PATH =
  process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin47') ? '/admin47' : '');

export function useRealtime() {
  return useContext(RealtimeContext);
}

/**
 * Provides real-time updates via SSE from the gateway-api.
 * Automatically invalidates relevant React Query caches when
 * events are received.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const qc = useQueryClient();
  const pathname = usePathname();
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>>();
  const normalizedPathname = (() => {
    if (!pathname) return '/';
    if (ADMIN_BASE_PATH && pathname.startsWith(ADMIN_BASE_PATH)) {
      const stripped = pathname.slice(ADMIN_BASE_PATH.length);
      return stripped.startsWith('/') ? stripped : `/${stripped}`;
    }
    return pathname;
  })();
  const realtimeDisabled =
    normalizedPathname === '/setup'
    || normalizedPathname.startsWith('/setup/')
    || normalizedPathname === '/login'
    || normalizedPathname.startsWith('/login/');

  useEffect(() => {
    if (realtimeDisabled) {
      esRef.current?.close();
      esRef.current = null;
      clearTimeout(retryRef.current);
      setConnected(false);
      setRuntimeHealth({ health: 'degraded', source: 'sse', message: 'Realtime stream disabled on setup pages.' });
      return () => undefined;
    }
    let cancelled = false;

    async function connect() {
      try {
        await api.auth.me();
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setConnected(false);
          setRuntimeHealth({ health: 'offline', source: 'sse', message: 'Realtime stream idle until login.' });
          retryRef.current = setTimeout(connect, 30000);
          return;
        }
      }

      if (cancelled) return;
      const es = new EventSource(`${ADMIN_BASE_PATH}/v1/admin/events`);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setRuntimeHealth({ health: 'online', source: 'sse', message: 'Realtime stream connected.' });
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);

          // Invalidate query caches based on event type
          const type = data.type ?? '';

          if (type.startsWith('approval')) {
            qc.invalidateQueries({ queryKey: ['approvals'] });
          } else if (type.startsWith('tool_run')) {
            qc.invalidateQueries({ queryKey: ['tool-runs'] });
          } else if (type.startsWith('user')) {
            qc.invalidateQueries({ queryKey: ['users'] });
          } else if (type.startsWith('chat')) {
            qc.invalidateQueries({ queryKey: ['chats'] });
          } else if (type.startsWith('health')) {
            qc.invalidateQueries({ queryKey: ['health'] });
          } else if (type.startsWith('incident')) {
            qc.invalidateQueries({ queryKey: ['incidents'] });
          } else if (type.startsWith('rag')) {
            qc.invalidateQueries({ queryKey: ['rag'] });
          } else if (type.startsWith('workflow')) {
            qc.invalidateQueries({ queryKey: ['workflows'] });
          } else if (type.startsWith('improvement')) {
            qc.invalidateQueries({ queryKey: ['improvements'] });
          } else if (type.startsWith('ha') || type.startsWith('home_assistant')) {
            qc.invalidateQueries({ queryKey: ['ha'] });
          } else if (type.startsWith('git')) {
            qc.invalidateQueries({ queryKey: ['git'] });
          } else if (type.startsWith('calendar')) {
            qc.invalidateQueries({ queryKey: ['calendar'] });
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        setRuntimeHealth({ health: 'degraded', source: 'sse', message: 'Realtime stream reconnecting.' });
        es.close();
        esRef.current = null;
        // Exponential backoff reconnect
        retryRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
      clearTimeout(retryRef.current);
    };
  }, [qc, realtimeDisabled]);

  return (
    <RealtimeContext.Provider value={{ connected, lastEvent }}>
      {children}
    </RealtimeContext.Provider>
  );
}

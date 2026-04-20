'use client';

import { useEffect, useRef, useState } from 'react';
import type { EidolonEvent } from '@/lib/api';

const MAX_EVENTS = 80;

export function useEidolonEvents(): EidolonEvent[] {
  const [events, setEvents] = useState<EidolonEvent[]>([]);
  const retryMs = useRef(1000);

  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource('/v1/eidolon/events');
      es.onopen = () => { retryMs.current = 1000; };
      es.onmessage = (msg) => handle(msg.data);
      ['market.listing_published','market.order_paid','market.fulfilled','market.refunded','treasury.credit','treasury.debit','agent.spawned','agent.retired','infra.node_change','heartbeat']
        .forEach((k) => es?.addEventListener(k, (msg: MessageEvent) => handle(msg.data)));
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        timer = setTimeout(connect, retryMs.current);
        retryMs.current = Math.min(retryMs.current * 2, 15000);
      };
    };

    const handle = (raw: string) => {
      try {
        const ev = JSON.parse(raw) as EidolonEvent;
        setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS));
      } catch {
        /* ignore malformed frame */
      }
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  return events;
}

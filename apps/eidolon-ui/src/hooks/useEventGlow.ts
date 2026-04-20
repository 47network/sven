'use client';

import { useRef, useMemo } from 'react';
import type { EidolonEvent, EidolonEventKind } from '@/lib/api';

// ---------------------------------------------------------------------------
// Maps SSE events to building IDs/kinds, producing transient glow boosts
// that decay over ~2 seconds. Buildings "light up" when economy activity
// happens — treasury credit → treasury_vault buildings pulse gold,
// market order_paid → marketplace_listing buildings pulse green, etc.
// ---------------------------------------------------------------------------

export interface GlowPulse {
  /** Boost value 0..1, decays over time */
  boost: number;
  /** Accent colour for the pulse */
  color: string;
  /** Timestamp when pulse started */
  startedAt: number;
}

const PULSE_DURATION_MS = 2000;

const EVENT_TO_KIND: Partial<Record<EidolonEventKind, {
  buildingKind: string;
  color: string;
}>> = {
  'treasury.credit':               { buildingKind: 'treasury_vault',      color: '#fbbf24' },
  'treasury.debit':                { buildingKind: 'treasury_vault',      color: '#f97316' },
  'market.order_paid':             { buildingKind: 'marketplace_listing', color: '#22c55e' },
  'market.listing_published':      { buildingKind: 'marketplace_listing', color: '#22d3ee' },
  'market.fulfilled':              { buildingKind: 'marketplace_listing', color: '#a78bfa' },
  'market.refunded':               { buildingKind: 'marketplace_listing', color: '#ef4444' },
  'market.task_created':           { buildingKind: 'marketplace_listing', color: '#06b6d4' },
  'market.task_completed':         { buildingKind: 'marketplace_listing', color: '#10b981' },
  'infra.node_change':             { buildingKind: 'infra_node',          color: '#38bdf8' },
  'agent.spawned':                 { buildingKind: 'revenue_service',     color: '#a3e635' },
  'agent.retired':                 { buildingKind: 'revenue_service',     color: '#f43f5e' },
  'agent.tokens_earned':           { buildingKind: 'treasury_vault',      color: '#facc15' },
  'agent.business_created':        { buildingKind: 'agent_business',      color: '#34d399' },
  'agent.business_activated':      { buildingKind: 'agent_business',      color: '#10b981' },
  'agent.business_deactivated':    { buildingKind: 'agent_business',      color: '#6b7280' },
  'crew.created':                  { buildingKind: 'crew_headquarters',   color: '#f472b6' },
  'crew.member_added':             { buildingKind: 'crew_headquarters',   color: '#ec4899' },
  'publishing.project_created':    { buildingKind: 'publishing_house',    color: '#c084fc' },
  'publishing.stage_advanced':     { buildingKind: 'publishing_house',    color: '#a78bfa' },
  'publishing.book_published':     { buildingKind: 'publishing_house',    color: '#8b5cf6' },
  'goal.completed':                { buildingKind: 'treasury_vault',      color: '#22d3ee' },
};

/**
 * Returns a ref-based getter that resolves the current glow boost for a
 * building kind. This is designed to be called inside a useFrame loop —
 * it DOES NOT trigger React re-renders.
 */
export function useEventGlow(events: EidolonEvent[]) {
  // Map<buildingKind, GlowPulse[]> — kept in a ref so useFrame reads don't re-render
  const pulsesRef = useRef(new Map<string, GlowPulse[]>());

  // Process new events on each React render (events array changes via setState)
  const processedRef = useRef(new Set<string>());

  useMemo(() => {
    for (const ev of events) {
      if (processedRef.current.has(ev.id)) continue;
      processedRef.current.add(ev.id);

      const mapping = EVENT_TO_KIND[ev.kind];
      if (!mapping) continue;

      const existing = pulsesRef.current.get(mapping.buildingKind) ?? [];
      existing.push({
        boost: 1.0,
        color: mapping.color,
        startedAt: Date.now(),
      });
      pulsesRef.current.set(mapping.buildingKind, existing);
    }

    // Keep processed set bounded
    if (processedRef.current.size > 200) {
      const arr = Array.from(processedRef.current);
      processedRef.current = new Set(arr.slice(arr.length - 100));
    }
  }, [events]);

  /** Call inside useFrame to get current boost for a building kind */
  function getGlowBoost(buildingKind: string): { boost: number; color: string } {
    const pulses = pulsesRef.current.get(buildingKind);
    if (!pulses || pulses.length === 0) return { boost: 0, color: '#ffffff' };

    const now = Date.now();

    // Prune expired pulses
    const active = pulses.filter((p) => now - p.startedAt < PULSE_DURATION_MS);
    pulsesRef.current.set(buildingKind, active);

    if (active.length === 0) return { boost: 0, color: '#ffffff' };

    // Use the most recent active pulse
    const latest = active[active.length - 1];
    const elapsed = now - latest.startedAt;
    const t = Math.max(0, 1 - elapsed / PULSE_DURATION_MS);
    // Ease-out curve for smooth decay
    const eased = t * t;

    return { boost: eased, color: latest.color };
  }

  return { getGlowBoost };
}

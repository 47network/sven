// ---------------------------------------------------------------------------
// WorldPulsePanel — at-a-glance simulation telemetry sourced from the
// extended /v1/eidolon/snapshot payload (snapshot.world).
// ---------------------------------------------------------------------------
// Renders three blocks:
//   1. Latest world tick: tick #, agents processed, interactions, revenue,
//      and the elapsed wall-clock since the tick (Bucharest-local).
//   2. Agent runtime mix: count per state (idle/working/talking/etc).
//   3. Recent interactions: last 3 chat/business exchanges with topic + message.
//
// Keeps UI lightweight (read-only, no internal state) and timezone-correct
// for Romanian operators via formatBucharestTime().
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { formatBucharestTime } from '@/lib/time';
import type { EidolonWorldOverview } from '@/lib/api';

interface Props {
  world: EidolonWorldOverview | null | undefined;
}

const STATE_LABELS: Record<string, string> = {
  idle: 'idle',
  exploring: 'explore',
  travelling: 'travel',
  talking: 'talk',
  working: 'work',
  building: 'build',
  returning_home: 'return',
  resting: 'rest',
};

function eurFromCents(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '€0.00';
  return `€${(cents / 100).toFixed(2)}`;
}

function relativeAge(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function WorldPulsePanel({ world }: Props) {
  const stateRows = useMemo(() => {
    if (!world) return [];
    const entries = Object.entries(world.agentRuntime.stateCounts ?? {});
    return entries
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [world]);

  if (!world) {
    return (
      <div className="glass-card px-4 py-3 w-72">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">world pulse</div>
        <div className="text-xs text-gray-500 mt-2">awaiting first snapshot…</div>
      </div>
    );
  }

  const tick = world.latestTick;
  const recent = world.recentInteractions.slice(0, 3);

  return (
    <div className="glass-card px-4 py-3 w-72 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">world pulse</div>
        {tick ? (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-brand-400">
              tick #{tick.tickNo}
            </span>
            <span
              className="text-[10px] text-gray-500"
              title={`Romanian time (Europe/Bucharest) · ${relativeAge(tick.startedAt)}`}
            >
              {formatBucharestTime(tick.startedAt)}
            </span>
          </div>
        ) : (
          <div className="text-xs text-gray-500 mt-1">no ticks yet</div>
        )}
        {tick && (
          <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
            <div>
              <div className="text-gray-500 uppercase tracking-wider text-[9px]">agents</div>
              <div className="text-gray-100 font-semibold">{tick.agentsProcessed}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase tracking-wider text-[9px]">talks</div>
              <div className="text-gray-100 font-semibold">{tick.interactions}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase tracking-wider text-[9px]">rev</div>
              <div className="text-gray-100 font-semibold">{eurFromCents(tick.revenueEurCents)}</div>
            </div>
          </div>
        )}
      </div>

      {stateRows.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">agents</div>
          <div className="flex flex-wrap gap-1">
            {stateRows.map(([state, n]) => (
              <span
                key={state}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-200"
                title={state}
              >
                {STATE_LABELS[state] ?? state} · {n}
              </span>
            ))}
          </div>
          {world.businesses.total > 0 && (
            <div className="mt-1 text-[10px] text-gray-500">
              businesses: {world.businesses.total}
              {world.businesses.statusCounts.earning
                ? ` · ${world.businesses.statusCounts.earning} earning`
                : ''}
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">recent talk</div>
          <ul className="space-y-1">
            {recent.map((it) => (
              <li key={it.id} className="text-[11px] leading-snug">
                <div className="flex justify-between text-gray-500 text-[9px] uppercase tracking-wider">
                  <span>{it.topic.replace(/_/g, ' ')}</span>
                  <span title="Romanian time (Europe/Bucharest)">
                    {formatBucharestTime(it.createdAt)}
                  </span>
                </div>
                <div className="text-gray-200 truncate" title={it.message}>
                  {it.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

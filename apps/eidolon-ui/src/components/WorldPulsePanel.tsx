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

import { useMemo, useState } from 'react';
import { formatBucharestTime } from '@/lib/time';
import type { EidolonWorldOverview, EidolonWorldTick } from '@/lib/api';

interface Props {
  world: EidolonWorldOverview | null | undefined;
}

// ---------------------------------------------------------------------------
// TickSparkline — dual-series mini-chart (revenue €, interactions) over the
// last N world ticks. Pure SVG, fixed 160×28 viewbox, no external deps.
// Renders nothing when fewer than 2 ticks are available.
// ---------------------------------------------------------------------------
function TickSparkline({ ticks }: { ticks: EidolonWorldTick[] }) {
  // Older-first ordering for left-to-right time flow.
  const ordered = useMemo(() => [...ticks].reverse().slice(-24), [ticks]);
  if (ordered.length < 2) return null;
  const w = 160;
  const h = 28;
  const pad = 1;
  const maxRev = Math.max(1, ...ordered.map((t) => t.revenueEurCents));
  const maxInt = Math.max(1, ...ordered.map((t) => t.interactions));
  const xStep = (w - pad * 2) / (ordered.length - 1);
  const toLine = (vals: number[], max: number) =>
    vals
      .map((v, i) => `${pad + i * xStep},${pad + (h - pad * 2) * (1 - v / max)}`)
      .join(' ');
  const revPts = toLine(ordered.map((t) => t.revenueEurCents), maxRev);
  const intPts = toLine(ordered.map((t) => t.interactions), maxInt);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="recent ticks" role="img">
      <polyline fill="none" stroke="#7c3aed" strokeWidth={1} points={intPts} opacity={0.55} />
      <polyline fill="none" stroke="#22d3ee" strokeWidth={1.2} points={revPts} />
    </svg>
  );
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
  // Tracks which interaction row is expanded to show full message + participants.
  // Local component state — no parent wiring needed.
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
        {world.recentTicks.length >= 2 && (
          <div className="mt-1.5 flex items-center justify-between">
            <TickSparkline ticks={world.recentTicks} />
            <div className="flex flex-col items-end gap-0.5 text-[9px] uppercase tracking-wider">
              <span className="text-[#22d3ee]">rev</span>
              <span className="text-[#7c3aed]">talks</span>
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
            {recent.map((it) => {
              const open = expandedId === it.id;
              return (
                <li key={it.id} className="text-[11px] leading-snug">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : it.id)}
                    aria-expanded={open}
                    className="w-full text-left rounded px-1 py-0.5 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-400"
                  >
                    <div className="flex justify-between text-gray-500 text-[9px] uppercase tracking-wider">
                      <span>
                        {open ? '▾' : '▸'} {it.topic.replace(/_/g, ' ')}
                        {it.influencedDecision ? ' · ★' : ''}
                      </span>
                      <span title="Romanian time (Europe/Bucharest)">
                        {formatBucharestTime(it.createdAt)}
                      </span>
                    </div>
                    <div
                      className={open ? 'text-gray-200 whitespace-pre-wrap' : 'text-gray-200 truncate'}
                      title={open ? undefined : it.message}
                    >
                      {it.message}
                    </div>
                    {open && (
                      <div className="mt-1 text-[10px] text-gray-500">
                        <span className="text-gray-300">{it.agentA}</span>
                        <span className="mx-1">↔</span>
                        <span className="text-gray-300">{it.agentB}</span>
                        {it.location ? <span className="ml-2">@ {it.location}</span> : null}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

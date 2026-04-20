// ---------------------------------------------------------------------------
// CitizenStripPanel — compact per-citizen badge strip surfacing the runtime
// telemetry that the WorldPulsePanel only exposes in aggregate.
//
// For every citizen with a known runtime row in `world.agentStates` we render:
//   - display name (label from snapshot.citizens, falling back to agentId)
//   - mood glyph (emoji) + textual mood
//   - 3-segment energy bar (0–100 mapped to 3 cells, colour-graded)
//   - current state label
//
// Read-only; never mutates parent state. Capped at 8 rows to keep the HUD
// from overflowing on small viewports.
// ---------------------------------------------------------------------------

'use client';

import { useMemo } from 'react';
import type {
  EidolonAgentMood,
  EidolonAgentRuntimeSlim,
  EidolonCitizen,
} from '@/lib/api';

interface Props {
  citizens: EidolonCitizen[];
  agentStates: Record<string, EidolonAgentRuntimeSlim> | null | undefined;
}

const MOOD_EMOJI: Record<EidolonAgentMood, string> = {
  happy: '😊',
  neutral: '😐',
  tired: '😴',
  frustrated: '😤',
  excited: '🤩',
  curious: '🤔',
};

const STATE_SHORT: Record<string, string> = {
  idle: 'idle',
  exploring: 'explore',
  travelling: 'travel',
  talking: 'talk',
  working: 'work',
  building: 'build',
  returning_home: 'return',
  resting: 'rest',
};

function rawAgentId(citizenId: string): string {
  return citizenId.startsWith('agent:') ? citizenId.slice('agent:'.length) : citizenId;
}

function energyColor(pct: number): string {
  if (pct >= 66) return 'bg-emerald-400';
  if (pct >= 33) return 'bg-amber-400';
  return 'bg-rose-500';
}

export function CitizenStripPanel({ citizens, agentStates }: Props) {
  const rows = useMemo(() => {
    if (!agentStates) return [];
    return citizens
      .map((c) => {
        const id = rawAgentId(c.id);
        const rt = agentStates[id];
        if (!rt) return null;
        return { id, label: c.label || id, runtime: rt };
      })
      .filter((r): r is { id: string; label: string; runtime: EidolonAgentRuntimeSlim } => r !== null)
      .slice(0, 8);
  }, [citizens, agentStates]);

  if (rows.length === 0) return null;

  return (
    <div className="glass-card px-3 py-2 w-72">
      <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1.5">citizens</div>
      <ul className="space-y-1">
        {rows.map(({ id, label, runtime }) => {
          const energyPct = Math.max(0, Math.min(100, Math.round(runtime.energy)));
          const segments = [33, 66, 100];
          return (
            <li key={id} className="flex items-center gap-2 text-[11px]">
              <span
                className="text-base leading-none"
                title={`mood: ${runtime.mood}`}
                aria-label={`mood ${runtime.mood}`}
              >
                {MOOD_EMOJI[runtime.mood] ?? '·'}
              </span>
              <span className="flex-1 truncate text-gray-200" title={label}>
                {label}
              </span>
              <span
                className="flex gap-0.5"
                title={`energy ${energyPct}%`}
                aria-label={`energy ${energyPct} percent`}
              >
                {segments.map((threshold) => (
                  <span
                    key={threshold}
                    className={`block h-2 w-2 rounded-sm ${
                      energyPct >= threshold - 16
                        ? energyColor(energyPct)
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-gray-500 w-12 text-right">
                {STATE_SHORT[runtime.state] ?? runtime.state}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

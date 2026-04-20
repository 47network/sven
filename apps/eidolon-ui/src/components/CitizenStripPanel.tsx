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

import { useMemo, useState } from 'react';
import type {
  EidolonAgentMood,
  EidolonAgentRuntimeSlim,
  EidolonCitizen,
} from '@/lib/api';

interface Props {
  citizens: EidolonCitizen[];
  agentStates: Record<string, EidolonAgentRuntimeSlim> | null | undefined;
  selectedId?: string | null;
  onSelect?: (citizenId: string) => void;
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

export function CitizenStripPanel({ citizens, agentStates, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const allRows = useMemo(() => {
    if (!agentStates) return [];
    return citizens
      .map((c) => {
        const id = rawAgentId(c.id);
        const rt = agentStates[id];
        if (!rt) return null;
        // Pass back the original citizen.id (with the `agent:` prefix if
        // present) so the page can match it against snapshot.citizens cleanly.
        return { id, citizenId: c.id, label: c.label || id, runtime: rt };
      })
      .filter(
        (r): r is { id: string; citizenId: string; label: string; runtime: EidolonAgentRuntimeSlim } =>
          r !== null,
      );
  }, [citizens, agentStates]);

  // Apply the user filter, then cap at 8 rows. Filter matches against label
  // and state (case-insensitive) so operators can quickly find e.g. "working"
  // citizens or anyone whose name starts with "max".
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allRows.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.runtime.state.toLowerCase().includes(q) ||
            r.runtime.mood.toLowerCase().includes(q),
        )
      : allRows;
    return filtered.slice(0, 8);
  }, [allRows, query]);

  if (allRows.length === 0) return null;
  const showSearch = allRows.length > 5;

  return (
    <div className="glass-card px-3 py-2 w-72">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
          citizens · {filteredRows.length}/{allRows.length}
        </div>
      </div>
      {showSearch && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter name / state / mood…"
          aria-label="filter citizens"
          className="w-full mb-1.5 px-2 py-1 text-[11px] rounded bg-white/5 border border-white/10 text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-brand-400/50"
        />
      )}
      {filteredRows.length === 0 && (
        <div className="text-[10px] text-gray-500 px-1 py-1">no matches</div>
      )}
      <ul className="space-y-1">
        {filteredRows.map(({ id, citizenId, label, runtime }) => {
          const energyPct = Math.max(0, Math.min(100, Math.round(runtime.energy)));
          const segments = [33, 66, 100];
          const isSelected = selectedId === citizenId;
          const RowTag = onSelect ? 'button' : 'div';
          return (
            <li key={id}>
              <RowTag
                {...(onSelect
                  ? {
                      type: 'button' as const,
                      onClick: () => onSelect(citizenId),
                      'aria-pressed': isSelected,
                      'aria-label': `inspect ${label}`,
                    }
                  : {})}
                className={`flex w-full items-center gap-2 text-[11px] rounded px-1 py-0.5 text-left transition-colors ${
                  onSelect ? 'cursor-pointer hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-400' : ''
                } ${isSelected ? 'bg-brand-500/15 ring-1 ring-brand-400/40' : ''}`}
              >
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
              </RowTag>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { InspectorPanel } from '@/components/InspectorPanel';

// CityScene uses react-three-fiber which is client-only.
const CityScene = dynamic(
  () => import('@/components/CityScene').then((m) => m.CityScene),
  { ssr: false },
);
import { EventFeed } from '@/components/EventFeed';
import { WorldPulsePanel } from '@/components/WorldPulsePanel';
import { CitizenStripPanel } from '@/components/CitizenStripPanel';
const WorldTimeBadge = dynamic(
  () => import('@/components/WorldTimeBadge').then((m) => m.WorldTimeBadge),
  { ssr: false },
);
import { useEidolonEvents } from '@/hooks/useEidolonEvents';
import { fetchSnapshot, type EidolonBuilding, type EidolonSnapshot } from '@/lib/api';

const REFRESH_MS = 15_000;
const DEFAULT_ORG = process.env.NEXT_PUBLIC_DEFAULT_ORG || 'default';

export default function EidolonPage() {
  const [snapshot, setSnapshot] = useState<EidolonSnapshot | null>(null);
  const [selected, setSelected] = useState<EidolonBuilding | null>(null);
  const [selectedCitizenId, setSelectedCitizenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const events = useEidolonEvents();

  // Selecting a building clears any citizen selection (and vice versa) so the
  // single InspectorPanel slot is never split between two contexts.
  const handleSelectBuilding = useCallback((b: EidolonBuilding | null) => {
    setSelected(b);
    if (b) setSelectedCitizenId(null);
  }, []);
  const handleSelectCitizen = useCallback((id: string | null) => {
    if (id == null) {
      setSelectedCitizenId(null);
      return;
    }
    setSelectedCitizenId((prev) => (prev === id ? null : id));
    setSelected(null);
  }, []);
  const handleClearAll = useCallback(() => {
    setSelected(null);
    setSelectedCitizenId(null);
  }, []);

  // Esc clears any active selection — quick way to dismiss the inspector
  // without hunting for the ✕ button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClearAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClearAll]);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const snap = await fetchSnapshot(DEFAULT_ORG, signal);
      setSnapshot(snap);
      setError(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    const id = setInterval(() => load(), REFRESH_MS);
    return () => { ctrl.abort(); clearInterval(id); };
  }, [load]);

  const treasury = snapshot?.treasury;
  const headlineMetrics = useMemo(() => {
    if (!snapshot) return [];
    const revenue = snapshot.buildings.reduce(
      (acc, b) => acc + (b.metrics.revenueUsd ?? 0),
      0,
    );
    return [
      { label: 'Buildings', value: String(snapshot.buildings.length) },
      { label: 'Citizens', value: String(snapshot.citizens.length) },
      { label: 'Revenue', value: `$${revenue.toFixed(2)}` },
      { label: 'Treasury', value: `$${treasury?.totalBalanceUsd.toFixed(2) ?? '0.00'}` },
    ];
  }, [snapshot, treasury]);

  // Currently selected entities, resolved from snapshot. Memoised so child
  // panels don't re-render on every snapshot tick when the selection is null.
  const selectedCitizen = useMemo(
    () =>
      selectedCitizenId
        ? snapshot?.citizens.find((c) => c.id === selectedCitizenId) ?? null
        : null,
    [snapshot, selectedCitizenId],
  );
  const selectedCitizenRuntime = useMemo(() => {
    if (!selectedCitizenId || !snapshot?.world?.agentStates) return null;
    const raw = selectedCitizenId.startsWith('agent:')
      ? selectedCitizenId.slice('agent:'.length)
      : selectedCitizenId;
    return snapshot.world.agentStates[raw] ?? null;
  }, [snapshot, selectedCitizenId]);

  // Occupants of the currently selected building — citizens whose
  // homeBuildingId points at it. Capped at 12 to keep the inspector compact.
  const buildingOccupants = useMemo(() => {
    if (!selected || !snapshot) return [];
    return snapshot.citizens
      .filter((c) => c.homeBuildingId === selected.id)
      .slice(0, 12);
  }, [selected, snapshot]);

  // Lookup helper: select a building by id (used by citizen "Home" cross-link).
  const handleSelectBuildingById = useCallback(
    (buildingId: string) => {
      const b = snapshot?.buildings.find((bb) => bb.id === buildingId) ?? null;
      if (b) handleSelectBuilding(b);
    },
    [snapshot, handleSelectBuilding],
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0">
        <CityScene
          snapshot={snapshot}
          selectedId={selected?.id ?? null}
          onSelect={handleSelectBuilding}
          events={events}
        />
      </div>

      <header className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2 pointer-events-auto">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500">eidolon</div>
            <div className="text-sm font-semibold text-brand-400">Sven · Autonomous Economy</div>
          </div>
          <WorldTimeBadge />
        </div>
        <div className="glass-card flex divide-x divide-white/5 pointer-events-auto">
          {headlineMetrics.map((m) => (
            <div key={m.label} className="px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{m.label}</div>
              <div className="text-sm font-semibold text-gray-100">{m.value}</div>
            </div>
          ))}
        </div>
      </header>

      <aside className="absolute top-20 left-4 z-10 space-y-3">
        <WorldPulsePanel world={snapshot?.world ?? null} />
        <CitizenStripPanel
          citizens={snapshot?.citizens ?? []}
          agentStates={snapshot?.world?.agentStates ?? null}
          selectedId={selectedCitizenId}
          onSelect={handleSelectCitizen}
        />
      </aside>

      <aside className="absolute bottom-4 left-4 z-10 w-80 space-y-3">
        <InspectorPanel
          building={selected}
          citizen={selectedCitizen}
          citizenRuntime={selectedCitizenRuntime}
          buildingOccupants={buildingOccupants}
          onSelectBuildingById={handleSelectBuildingById}
          onSelectCitizen={handleSelectCitizen}
          onClose={handleClearAll}
        />
      </aside>

      <aside className="absolute bottom-4 right-4 z-10 w-96">
        <EventFeed events={events} />
      </aside>

      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 chip-err">
          snapshot error: {error}
        </div>
      )}
    </main>
  );
}

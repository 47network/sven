'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stars, Html } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import type { EidolonSnapshot, EidolonBuilding, EidolonEvent } from '@/lib/api';
import { Building } from './Building';
import { Citizen } from './Citizen';
import { ParcelGrid } from './ParcelGrid';
import { MovementPaths, locationToPos } from './MovementPaths';
import { useEventGlow } from '@/hooks/useEventGlow';
import { useWorldTime } from '@/hooks/useWorldTime';

interface Props {
  snapshot: EidolonSnapshot | null;
  selectedId: string | null;
  onSelect: (b: EidolonBuilding | null) => void;
  events: EidolonEvent[];
}

function CityContent({ snapshot, selectedId, onSelect, events }: Props) {
  const buildings = snapshot?.buildings ?? [];
  const citizens = snapshot?.citizens ?? [];
  const parcels = snapshot?.parcels ?? [];
  const agentStates = snapshot?.world?.agentStates ?? null;
  const { getGlowBoost } = useEventGlow(events);

  const districtLabels = useMemo(
    () => [
      { label: 'Treasury',  pos: [0, 0, 0] as [number, number, number], color: '#f59e0b' },
      { label: 'Market',    pos: [-80, 0, -40] as [number, number, number], color: '#22d3ee' },
      { label: 'Revenue',   pos: [80, 0, -40] as [number, number, number], color: '#7c3aed' },
      { label: 'Infra',     pos: [0, 0, 80] as [number, number, number], color: '#38bdf8' },
    ],
    [],
  );

  // Build per-agent parcel coord lookup once per snapshot — used to resolve
  // 'parcel' targetLocations into world space for movement paths.
  const parcelByAgent = useMemo(() => {
    const m = new Map<string, { x: number; z: number }>();
    for (const p of parcels) m.set(p.agentId, { x: p.gridX, z: p.gridZ });
    return m;
  }, [parcels]);

  // Live movement paths: any citizen whose runtime state implies travel
  // (travelling, returning_home, exploring) gets a dashed bezier arc from its
  // current position to its target. Skips when no targetLocation is known or
  // when source and target collapse to the same point.
  const movements = useMemo(() => {
    if (!agentStates) return [];
    const out: { id: string; agentName?: string; fromX: number; fromZ: number; toX: number; toZ: number }[] = [];
    for (const c of citizens) {
      const rawAgentId = c.id.startsWith('agent:') ? c.id.slice('agent:'.length) : c.id;
      const rt = agentStates[rawAgentId];
      if (!rt) continue;
      if (rt.state !== 'travelling' && rt.state !== 'returning_home' && rt.state !== 'exploring') continue;
      const target = rt.targetLocation;
      if (!target) continue;
      const home = parcelByAgent.get(rawAgentId);
      const to = locationToPos(target, home?.x, home?.z);
      const dx = to.x - c.position.x;
      const dz = to.z - c.position.z;
      if (dx * dx + dz * dz < 4) continue; // < 2 units apart — not worth drawing
      out.push({
        id: c.id,
        agentName: c.label,
        fromX: c.position.x,
        fromZ: c.position.z,
        toX: to.x,
        toZ: to.z,
      });
    }
    return out;
  }, [agentStates, citizens, parcelByAgent]);

  return (
    <>
      {districtLabels.map((d) => (
        <Html key={d.label} position={[d.pos[0], 50, d.pos[2]]} center distanceFactor={140}>
          <div
            className="pointer-events-none select-none rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-[11px] font-medium tracking-wider uppercase backdrop-blur"
            style={{ color: d.color }}
          >
            {d.label}
          </div>
        </Html>
      ))}

      {buildings.map((b) => {
        const glow = getGlowBoost(b.kind);
        return (
          <Building
            key={b.id}
            building={b}
            selected={selectedId === b.id}
            onSelect={onSelect}
            glowBoost={glow.boost}
            glowColor={glow.color}
          />
        );
      })}

      {citizens.map((c) => {
        // citizen.id is `agent:<agentId>`; agentStates is keyed by raw agentId.
        const rawAgentId = c.id.startsWith('agent:') ? c.id.slice('agent:'.length) : c.id;
        const runtime = agentStates?.[rawAgentId] ?? null;
        return <Citizen key={c.id} citizen={c} runtime={runtime} />;
      })}

      {/* Suburban parcels */}
      <ParcelGrid parcels={parcels} />

      {/* Live travel arcs — citizens travelling/returning_home/exploring */}
      <MovementPaths movements={movements} />
    </>
  );
}

export function CityScene({ snapshot, selectedId, onSelect, events }: Props) {
  const worldTime = useWorldTime();
  return (
    <Canvas
      shadows
      camera={{ position: [120, 90, 140], fov: 48 }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#020307']} />
      <fog attach="fog" args={['#020307', 180, 420]} />
      <Stars radius={260} depth={60} count={3000} factor={3.5} fade />

      <ambientLight intensity={worldTime.phase === 'night' ? 0.12 : worldTime.phase === 'dawn' || worldTime.phase === 'dusk' ? 0.25 : 0.35} />
      <directionalLight
        position={[80, 120, 60]}
        intensity={worldTime.phase === 'night' ? 0.3 : worldTime.phase === 'dawn' || worldTime.phase === 'dusk' ? 0.7 : 1.1}
        color={worldTime.phase === 'dawn' ? '#fbbf24' : worldTime.phase === 'dusk' ? '#f97316' : '#ffffff'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Grid
        args={[400, 400]}
        cellSize={4}
        cellColor="#1f2a3f"
        sectionSize={20}
        sectionColor="#334155"
        fadeDistance={260}
        fadeStrength={1.6}
        infiniteGrid
      />

      <Suspense fallback={null}>
        <CityContent
          snapshot={snapshot}
          selectedId={selectedId}
          onSelect={onSelect}
          events={events}
        />
      </Suspense>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={40}
        maxDistance={360}
      />
    </Canvas>
  );
}

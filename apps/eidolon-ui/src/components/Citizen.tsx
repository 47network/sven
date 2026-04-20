'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import type { EidolonAgentRuntimeSlim, EidolonCitizen } from '@/lib/api';

const STATUS_COLOR: Record<EidolonCitizen['status'], string> = {
  idle: '#64748b',
  working: '#22d3ee',
  earning: '#a3e635',
  retiring: '#f43f5e',
};

const STATUS_PULSE: Record<EidolonCitizen['status'], { speed: number; amplitude: number }> = {
  idle:     { speed: 1.0, amplitude: 0.1 },
  working:  { speed: 1.8, amplitude: 0.15 },
  earning:  { speed: 2.5, amplitude: 0.25 },
  retiring: { speed: 4.0, amplitude: 0.4 },
};

// ── Live agent-runtime state visuals ──────────────────────────────────────
// When the snapshot includes per-agent runtime state (from the new
// /v1/eidolon/snapshot world.agentStates map), citizens override their
// listing-derived status with the live state. Falls back to STATUS_COLOR
// when the snapshot's world overview is unavailable (older backend, fetch
// failure, or pre-seed orgs).
const RUNTIME_COLOR: Record<EidolonAgentRuntimeSlim['state'], string> = {
  idle:           '#64748b',
  exploring:      '#38bdf8',
  travelling:     '#0ea5e9',
  talking:        '#f59e0b',
  working:        '#22d3ee',
  building:       '#a78bfa',
  returning_home: '#94a3b8',
  resting:        '#475569',
};

const RUNTIME_PULSE: Record<EidolonAgentRuntimeSlim['state'], { speed: number; amplitude: number }> = {
  idle:           { speed: 0.8, amplitude: 0.08 },
  exploring:      { speed: 1.6, amplitude: 0.18 },
  travelling:     { speed: 2.2, amplitude: 0.22 },
  talking:        { speed: 3.0, amplitude: 0.30 },
  working:        { speed: 1.8, amplitude: 0.15 },
  building:       { speed: 2.4, amplitude: 0.25 },
  returning_home: { speed: 1.2, amplitude: 0.10 },
  resting:        { speed: 0.5, amplitude: 0.05 },
};

// Archetype → distinct geometry shape. Agents are visually unique.
const ARCHETYPE_GEO: Record<string, 'sphere' | 'cone' | 'cylinder' | 'octahedron' | 'dodecahedron' | 'torus' | 'icosahedron'> = {
  seller:     'cone',
  translator: 'cylinder',
  writer:     'dodecahedron',
  scout:      'icosahedron',
  analyst:    'octahedron',
  operator:   'cylinder',
  accountant: 'octahedron',
  marketer:   'cone',
  researcher: 'dodecahedron',
  legal:      'torus',
  designer:   'icosahedron',
  support:    'sphere',
  strategist: 'dodecahedron',
  recruiter:  'cone',
  custom:     'sphere',
};

function CitizenGeometry({ archetype }: { archetype: string | undefined }) {
  const shape = (archetype && ARCHETYPE_GEO[archetype]) ?? 'sphere';
  switch (shape) {
    case 'cone':         return <coneGeometry args={[0.5, 1.2, 8]} />;
    case 'cylinder':     return <cylinderGeometry args={[0.4, 0.4, 1.0, 8]} />;
    case 'octahedron':   return <octahedronGeometry args={[0.6]} />;
    case 'dodecahedron': return <dodecahedronGeometry args={[0.55]} />;
    case 'torus':        return <torusGeometry args={[0.4, 0.15, 8, 16]} />;
    case 'icosahedron':  return <icosahedronGeometry args={[0.55]} />;
    default:             return <sphereGeometry args={[0.6, 16, 16]} />;
  }
}

interface Props {
  citizen: EidolonCitizen;
  runtime?: EidolonAgentRuntimeSlim | null;
}

export function Citizen({ citizen, runtime }: Props) {
  const ref = useRef<Mesh>(null);
  const seed = citizen.id.charCodeAt(citizen.id.length - 1) / 255;

  // Live runtime state wins over listing-derived status when available, so
  // operators see the actual simulation behaviour (talking/travelling/etc).
  const baseColor = runtime ? RUNTIME_COLOR[runtime.state] : STATUS_COLOR[citizen.status];
  const pulse     = runtime ? RUNTIME_PULSE[runtime.state] : STATUS_PULSE[citizen.status];
  const targetColor = new Color(baseColor);

  // Low energy dims the agent; full energy keeps it bright. Bounded [0.4, 1.2]
  // so visuals never go fully dark (still selectable).
  const energyFactor = runtime ? Math.max(0.4, Math.min(1.2, runtime.energy / 100)) : 1;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed * 10;

    // Bob animation
    ref.current.position.y = 1 + Math.sin(t * pulse.speed) * pulse.amplitude;

    // Smoothly transition emissive colour towards current status/state
    const mat = ref.current.material as MeshStandardMaterial;
    mat.emissive.lerp(targetColor, 0.05);

    // Pulsing emissive intensity. Talking and earning agents get a stronger,
    // attention-grabbing pulse; retiring agents flicker urgently.
    const intensityBase = (
      runtime?.state === 'talking' || citizen.status === 'earning'
        ? 1.0
        : 0.8
    ) * energyFactor;
    const intensityVariance = citizen.status === 'retiring'
      ? Math.abs(Math.sin(t * 6)) * 0.5
      : runtime?.state === 'talking'
        ? Math.abs(Math.sin(t * 4)) * 0.35
        : Math.sin(t * 2) * 0.15;
    mat.emissiveIntensity = intensityBase + intensityVariance;
  });

  return (
    <mesh
      ref={ref}
      position={[citizen.position.x, 1, citizen.position.z]}
      castShadow
    >
      <CitizenGeometry archetype={citizen.archetype} />
      <meshStandardMaterial
        color={baseColor}
        emissive={baseColor}
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

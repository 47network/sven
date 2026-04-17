'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import type { EidolonCitizen } from '@/lib/api';

const STATUS_COLOR: Record<EidolonCitizen['status'], string> = {
  idle: '#64748b',
  working: '#22d3ee',
  earning: '#a3e635',
  retiring: '#f43f5e',
};

// Earning citizens pulse brighter, retiring ones flicker
const STATUS_PULSE: Record<EidolonCitizen['status'], { speed: number; amplitude: number }> = {
  idle:     { speed: 1.0, amplitude: 0.1 },
  working:  { speed: 1.8, amplitude: 0.15 },
  earning:  { speed: 2.5, amplitude: 0.25 },
  retiring: { speed: 4.0, amplitude: 0.4 },
};

interface Props { citizen: EidolonCitizen }

export function Citizen({ citizen }: Props) {
  const ref = useRef<Mesh>(null);
  const seed = citizen.id.charCodeAt(citizen.id.length - 1) / 255;
  const targetColor = new Color(STATUS_COLOR[citizen.status]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed * 10;
    const pulse = STATUS_PULSE[citizen.status];

    // Bob animation
    ref.current.position.y = 1 + Math.sin(t * pulse.speed) * pulse.amplitude;

    // Smoothly transition emissive colour towards current status
    const mat = ref.current.material as MeshStandardMaterial;
    mat.emissive.lerp(targetColor, 0.05);

    // Pulsing emissive intensity for earning/retiring states
    const intensityBase = citizen.status === 'earning' ? 1.0 : 0.8;
    const intensityVariance = citizen.status === 'retiring'
      ? Math.abs(Math.sin(t * 6)) * 0.5   // rapid flicker
      : Math.sin(t * 2) * 0.15;            // gentle pulse
    mat.emissiveIntensity = intensityBase + intensityVariance;
  });

  return (
    <mesh
      ref={ref}
      position={[citizen.position.x, 1, citizen.position.z]}
      castShadow
    >
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshStandardMaterial
        color={STATUS_COLOR[citizen.status]}
        emissive={STATUS_COLOR[citizen.status]}
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

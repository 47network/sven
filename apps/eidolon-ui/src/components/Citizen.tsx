'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { EidolonCitizen } from '@/lib/api';

const STATUS_COLOR: Record<EidolonCitizen['status'], string> = {
  idle: '#64748b',
  working: '#22d3ee',
  earning: '#a3e635',
  retiring: '#f43f5e',
};

interface Props { citizen: EidolonCitizen }

export function Citizen({ citizen }: Props) {
  const ref = useRef<Mesh>(null);
  const seed = citizen.id.charCodeAt(citizen.id.length - 1) / 255;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed * 10;
    ref.current.position.y = 1 + Math.sin(t * 1.8) * 0.15;
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

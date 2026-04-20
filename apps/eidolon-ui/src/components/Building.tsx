'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshStandardMaterial } from 'three';
import { Color } from 'three';
import type { EidolonBuilding } from '@/lib/api';

const STATUS_COLOR: Record<EidolonBuilding['status'], string> = {
  ok: '#22d3ee',
  degraded: '#fbbf24',
  down: '#f43f5e',
  idle: '#64748b',
};

const KIND_ACCENT: Record<EidolonBuilding['kind'], string> = {
  marketplace_listing: '#22d3ee',
  revenue_service: '#7c3aed',
  infra_node: '#38bdf8',
  treasury_vault: '#f59e0b',
  agent_business: '#10b981',
  crew_headquarters: '#f472b6',
  publishing_house: '#a78bfa',
};

interface Props {
  building: EidolonBuilding;
  onSelect: (b: EidolonBuilding) => void;
  selected: boolean;
  /** Event-driven glow boost 0..1 */
  glowBoost?: number;
  /** Event-driven glow colour */
  glowColor?: string;
}

export function Building({ building, onSelect, selected, glowBoost = 0, glowColor }: Props) {
  const meshRef = useRef<Mesh>(null);
  const baseColor = STATUS_COLOR[building.status];
  const accent = KIND_ACCENT[building.kind];
  const width = useMemo(
    () =>
      building.kind === 'treasury_vault' ? 10
      : building.kind === 'infra_node' ? 7
      : building.kind === 'crew_headquarters' ? 8
      : building.kind === 'publishing_house' ? 6
      : 5,
    [building.kind],
  );
  const depth = width;
  const y = building.height / 2;

  // Smoothly animate emissive intensity based on glow boost
  const targetRef = useRef({ intensity: 0.2 + building.glow * 0.8, color: new Color(accent) });
  const currentRef = useRef({ intensity: 0.2 + building.glow * 0.8, color: new Color(accent) });

  useFrame(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as MeshStandardMaterial;

    // Target intensity: base glow + event boost
    const baseIntensity = 0.2 + building.glow * 0.8;
    targetRef.current.intensity = baseIntensity + glowBoost * 1.5;

    // Smoothly interpolate towards target
    const lerp = 0.08;
    currentRef.current.intensity += (targetRef.current.intensity - currentRef.current.intensity) * lerp;
    mat.emissiveIntensity = currentRef.current.intensity;

    // Blend emissive colour towards event glow colour during pulse
    if (glowBoost > 0.05 && glowColor) {
      const pulseColor = new Color(glowColor);
      const baseColorObj = new Color(accent);
      mat.emissive.copy(baseColorObj).lerp(pulseColor, glowBoost);
    } else {
      mat.emissive.set(accent);
    }
  });

  return (
    <group
      position={[building.position.x, 0, building.position.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(building); }}
    >
      <mesh ref={meshRef} position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, building.height, depth]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={accent}
          emissiveIntensity={0.2 + building.glow * 0.8}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      {selected && (
        <mesh position={[0, building.height + 2, 0]}>
          <ringGeometry args={[width * 0.6, width * 0.8, 32]} />
          <meshBasicMaterial color={accent} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

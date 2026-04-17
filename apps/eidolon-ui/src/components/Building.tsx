'use client';

import { useMemo } from 'react';
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
};

interface Props {
  building: EidolonBuilding;
  onSelect: (b: EidolonBuilding) => void;
  selected: boolean;
}

export function Building({ building, onSelect, selected }: Props) {
  const color = STATUS_COLOR[building.status];
  const accent = KIND_ACCENT[building.kind];
  const width = useMemo(
    () => (building.kind === 'treasury_vault' ? 10 : building.kind === 'infra_node' ? 7 : 5),
    [building.kind],
  );
  const depth = width;
  const y = building.height / 2;

  return (
    <group
      position={[building.position.x, 0, building.position.z]}
      onClick={(e) => { e.stopPropagation(); onSelect(building); }}
    >
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, building.height, depth]} />
        <meshStandardMaterial
          color={color}
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

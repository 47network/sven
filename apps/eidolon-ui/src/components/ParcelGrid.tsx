'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import type { EidolonParcel } from '@/lib/api';

const ZONE_COLOR: Record<string, string> = {
  residential: '#6366f1',
  commercial:  '#22d3ee',
  workshop:    '#f59e0b',
  laboratory:  '#a78bfa',
  farm:        '#4ade80',
  outpost:     '#f43f5e',
  estate:      '#c084fc',
};

const SIZE_SCALE: Record<string, number> = {
  small: 3,
  medium: 5,
  large: 8,
  estate: 12,
};

interface Props {
  parcels: EidolonParcel[];
}

export function ParcelGrid({ parcels }: Props) {
  const parcelMeshes = useMemo(
    () =>
      parcels.map((p) => {
        const color = ZONE_COLOR[p.zone] ?? '#64748b';
        const scale = SIZE_SCALE[p.parcelSize] ?? 3;
        // Structures give height
        const structureHeight = Math.max(1, (p.structures?.length ?? 0) * 1.5 + 1);
        return { ...p, color, scale, structureHeight };
      }),
    [parcels],
  );

  return (
    <group>
      {parcelMeshes.map((p) => (
        <group key={p.id} position={[p.gridX, 0, p.gridZ]}>
          {/* Parcel ground plate */}
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <boxGeometry args={[p.scale, 0.1, p.scale]} />
            <meshStandardMaterial
              color={p.color}
              transparent
              opacity={0.4}
              metalness={0.3}
              roughness={0.7}
            />
          </mesh>
          {/* Structure if present */}
          {p.structures.length > 0 && (
            <mesh position={[0, p.structureHeight / 2, 0]} castShadow>
              <boxGeometry args={[p.scale * 0.6, p.structureHeight, p.scale * 0.6]} />
              <meshStandardMaterial
                color={p.color}
                emissive={p.color}
                emissiveIntensity={0.3}
                metalness={0.5}
                roughness={0.4}
              />
            </mesh>
          )}
          {/* Location beacon for agents in city */}
          {p.currentLocation !== 'parcel' && p.currentLocation !== 'away' && (
            <mesh position={[0, p.structureHeight + 1.5, 0]}>
              <sphereGeometry args={[0.3, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
            </mesh>
          )}
          {/* Zone label */}
          <Html position={[0, p.structureHeight + 2.5, 0]} center distanceFactor={100}>
            <div className="pointer-events-none select-none text-[9px] text-white/40 uppercase tracking-wider">
              {p.zone}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

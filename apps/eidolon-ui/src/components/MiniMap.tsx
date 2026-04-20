'use client';

import { useMemo } from 'react';
import type { EidolonBuilding, EidolonCitizen, EidolonParcel } from '@/lib/api';

const MAP_SIZE = 140; // px
const WORLD_HALF = 200; // scene grid spans ±200

function toMap(worldX: number, worldZ: number) {
  return {
    x: ((worldX + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE,
    y: ((worldZ + WORLD_HALF) / (WORLD_HALF * 2)) * MAP_SIZE,
  };
}

const KIND_COLOR: Record<EidolonBuilding['kind'], string> = {
  marketplace_listing: '#22d3ee',
  revenue_service: '#7c3aed',
  infra_node: '#38bdf8',
  treasury_vault: '#f59e0b',
  agent_business: '#10b981',
  crew_headquarters: '#f472b6',
  publishing_house: '#a78bfa',
};

interface Props {
  buildings: EidolonBuilding[];
  citizens: EidolonCitizen[];
  parcels: EidolonParcel[];
  selectedBuildingId?: string | null;
  selectedParcelId?: string | null;
}

export function MiniMap({ buildings, citizens, parcels, selectedBuildingId, selectedParcelId }: Props) {
  const buildingDots = useMemo(
    () =>
      buildings.map((b) => {
        const { x, y } = toMap(b.position.x, b.position.z);
        return { id: b.id, x, y, color: KIND_COLOR[b.kind] ?? '#64748b', selected: b.id === selectedBuildingId };
      }),
    [buildings, selectedBuildingId],
  );

  const citizenDots = useMemo(
    () =>
      citizens.map((c) => {
        const { x, y } = toMap(c.position.x, c.position.z);
        return { id: c.id, x, y };
      }),
    [citizens],
  );

  const parcelDots = useMemo(
    () =>
      parcels.map((p) => {
        const { x, y } = toMap(p.gridX, p.gridZ);
        return { id: p.id, x, y, selected: p.id === selectedParcelId };
      }),
    [parcels, selectedParcelId],
  );

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-lg border border-white/10 bg-surface/70 p-1 backdrop-blur"
      style={{ width: MAP_SIZE + 8, height: MAP_SIZE + 8 }}
    >
      <svg width={MAP_SIZE} height={MAP_SIZE} className="block">
        {/* Grid crosshair */}
        <line x1={MAP_SIZE / 2} y1={0} x2={MAP_SIZE / 2} y2={MAP_SIZE} stroke="#334155" strokeWidth={0.5} />
        <line x1={0} y1={MAP_SIZE / 2} x2={MAP_SIZE} y2={MAP_SIZE / 2} stroke="#334155" strokeWidth={0.5} />

        {/* Parcels — small squares */}
        {parcelDots.map((p) => (
          <rect
            key={p.id}
            x={p.x - 2}
            y={p.y - 2}
            width={4}
            height={4}
            fill={p.selected ? '#22d3ee' : '#334155'}
            opacity={p.selected ? 1 : 0.4}
          />
        ))}

        {/* Buildings — coloured circles */}
        {buildingDots.map((b) => (
          <circle
            key={b.id}
            cx={b.x}
            cy={b.y}
            r={b.selected ? 4 : 2.5}
            fill={b.color}
            opacity={b.selected ? 1 : 0.7}
            stroke={b.selected ? '#ffffff' : 'none'}
            strokeWidth={b.selected ? 1 : 0}
          />
        ))}

        {/* Citizens — tiny white dots */}
        {citizenDots.map((c) => (
          <circle key={c.id} cx={c.x} cy={c.y} r={1} fill="#e2e8f0" opacity={0.5} />
        ))}
      </svg>
    </div>
  );
}

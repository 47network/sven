'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ActiveMovement {
  id: string;
  agentName?: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
}

const DISTRICT_POS: Record<string, { x: number; z: number }> = {
  city_treasury: { x: 0, z: 0 },
  city_market:   { x: -80, z: -40 },
  city_revenue:  { x: 80, z: -40 },
  city_infra:    { x: 0, z: 80 },
  city_centre:   { x: 0, z: 0 },
};

export function locationToPos(loc: string, gridX?: number, gridZ?: number): { x: number; z: number } {
  if (loc === 'parcel' && gridX !== undefined && gridZ !== undefined) {
    return { x: gridX, z: gridZ };
  }
  return DISTRICT_POS[loc] ?? { x: 0, z: 0 };
}

interface Props {
  movements: ActiveMovement[];
}

export function MovementPaths({ movements }: Props) {
  return (
    <group>
      {movements.map((m) => (
        <MovementLine key={m.id} movement={m} />
      ))}
    </group>
  );
}

function MovementLine({ movement }: { movement: ActiveMovement }) {
  const ref = useRef<THREE.Line>(null);
  const dashOffset = useRef(0);

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(movement.fromX, 1.5, movement.fromZ),
      new THREE.Vector3(
        (movement.fromX + movement.toX) / 2,
        8,
        (movement.fromZ + movement.toZ) / 2,
      ),
      new THREE.Vector3(movement.toX, 1.5, movement.toZ),
    ];
    const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));
    return geo;
  }, [movement.fromX, movement.fromZ, movement.toX, movement.toZ]);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: '#22d3ee',
        dashSize: 2,
        gapSize: 1,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  useFrame(() => {
    if (!ref.current) return;
    dashOffset.current += 0.05;
    (ref.current.material as THREE.LineDashedMaterial).dashOffset = -dashOffset.current;
  });

  return (
    <primitive
      ref={ref}
      object={new THREE.Line(geometry, material)}
      computeLineDistances
    />
  );
}

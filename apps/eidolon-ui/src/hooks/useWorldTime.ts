'use client';

import { useEffect, useState } from 'react';

export interface WorldTimeState {
  worldMs: number;
  dayFraction: number;
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  dayNumber: number;
}

// Anchor world day/night cycle to Bucharest civil midnight on 2026-01-01
// (EET = UTC+02:00 in January). Sven's operators are in Romania, so the
// in-world dawn/day/dusk/night phases align with Romanian wall-clock
// perception rather than UTC.
const WORLD_EPOCH = new Date('2026-01-01T00:00:00+02:00').getTime();
const WORLD_SPEED = 60;
const WORLD_DAY_MS = 86_400_000;

function calculateWorldTime(realMs: number): WorldTimeState {
  const elapsed = (realMs - WORLD_EPOCH) * WORLD_SPEED;
  const dayNumber = Math.floor(elapsed / WORLD_DAY_MS);
  const dayProgress = (elapsed % WORLD_DAY_MS) / WORLD_DAY_MS;

  let phase: WorldTimeState['phase'];
  if (dayProgress < 0.25) phase = 'dawn';
  else if (dayProgress < 0.5) phase = 'day';
  else if (dayProgress < 0.75) phase = 'dusk';
  else phase = 'night';

  return { worldMs: elapsed, dayFraction: dayProgress, phase, dayNumber };
}

/**
 * Updates every 2 seconds with current world time (60× speed).
 * Returns phase, dayFraction (0..1), and dayNumber for lighting.
 */
export function useWorldTime(): WorldTimeState {
  const [time, setTime] = useState(() => calculateWorldTime(Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateWorldTime(Date.now()));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

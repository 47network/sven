'use client';

import { useRuntime } from '@/lib/store';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export default function RuntimeBanner() {
  const runtime = useRuntime();
  const cls =
    runtime.health === 'online'
      ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-300'
      : runtime.health === 'offline'
        ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  const Icon = runtime.health === 'online' ? Wifi : runtime.health === 'offline' ? WifiOff : AlertTriangle;

  return (
    <div className={`mx-6 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium capitalize">{runtime.health}</span>
      <span className="opacity-80">({runtime.source})</span>
      <span className="opacity-90">{runtime.message}</span>
    </div>
  );
}

'use client';

import type { EidolonBuilding } from '@/lib/api';

const KIND_LABEL: Record<EidolonBuilding['kind'], string> = {
  marketplace_listing: 'Marketplace Listing',
  revenue_service: 'Revenue Service',
  infra_node: 'Infra Node',
  treasury_vault: 'Treasury Vault',
};

const STATUS_CLASS: Record<EidolonBuilding['status'], string> = {
  ok: 'chip-ok',
  degraded: 'chip-warn',
  down: 'chip-err',
  idle: 'chip',
};

interface Props { building: EidolonBuilding | null }

export function InspectorPanel({ building }: Props) {
  if (!building) {
    return (
      <div className="glass-card p-4 text-xs text-gray-400">
        Click any building in the city to inspect it.
      </div>
    );
  }
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            {KIND_LABEL[building.kind]} · {building.district}
          </div>
          <div className="text-sm font-semibold text-gray-100">{building.label}</div>
        </div>
        <span className={STATUS_CLASS[building.status]}>{building.status}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        {building.metrics.revenueUsd != null && (
          <Stat label="Revenue" value={`$${building.metrics.revenueUsd.toFixed(2)}`} />
        )}
        {building.metrics.salesCount != null && (
          <Stat label="Sales / calls" value={String(building.metrics.salesCount)} />
        )}
        {building.metrics.cpuPct != null && (
          <Stat label="CPU" value={`${building.metrics.cpuPct.toFixed(0)}%`} />
        )}
        {building.metrics.memPct != null && (
          <Stat label="Memory" value={`${building.metrics.memPct.toFixed(0)}%`} />
        )}
        <Stat label="Glow" value={building.glow.toFixed(2)} />
        <Stat label="Height" value={building.height.toFixed(1)} />
      </dl>
      <div className="text-[10px] font-mono text-gray-500 break-all">{building.id}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-100">{value}</div>
    </div>
  );
}

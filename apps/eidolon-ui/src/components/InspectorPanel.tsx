'use client';

import type {
  EidolonAgentMood,
  EidolonAgentRuntimeSlim,
  EidolonBuilding,
  EidolonCitizen,
} from '@/lib/api';

const KIND_LABEL: Record<EidolonBuilding['kind'], string> = {
  marketplace_listing: 'Marketplace Listing',
  revenue_service: 'Revenue Service',
  infra_node: 'Infra Node',
  treasury_vault: 'Treasury Vault',
  agent_business: 'Agent Business',
  crew_headquarters: 'Crew Headquarters',
  publishing_house: 'Publishing House',
};

const STATUS_CLASS: Record<EidolonBuilding['status'], string> = {
  ok: 'chip-ok',
  degraded: 'chip-warn',
  down: 'chip-err',
  idle: 'chip',
};

const MOOD_EMOJI: Record<EidolonAgentMood, string> = {
  happy: '😊',
  neutral: '😐',
  tired: '😴',
  frustrated: '😤',
  excited: '🤩',
  curious: '🤔',
};

const RUNTIME_STATE_LABEL: Record<string, string> = {
  idle: 'Idle',
  exploring: 'Exploring',
  travelling: 'Travelling',
  talking: 'Talking',
  working: 'Working',
  building: 'Building',
  returning_home: 'Returning Home',
  resting: 'Resting',
};

const CITIZEN_STATUS_CLASS: Record<EidolonCitizen['status'], string> = {
  idle: 'chip',
  working: 'chip-ok',
  earning: 'chip-ok',
  retiring: 'chip-warn',
};

interface Props {
  building: EidolonBuilding | null;
  citizen?: EidolonCitizen | null;
  citizenRuntime?: EidolonAgentRuntimeSlim | null;
  buildingOccupants?: EidolonCitizen[];
  onSelectBuildingById?: (buildingId: string) => void;
  onSelectCitizen?: (citizenId: string) => void;
  onClose?: () => void;
}

// Citizen selection takes precedence over building selection so a freshly
// clicked citizen always wins the inspector slot. The page also clears the
// other selection when one is set, but precedence here is the safety net.
export function InspectorPanel({
  building,
  citizen,
  citizenRuntime,
  buildingOccupants,
  onSelectBuildingById,
  onSelectCitizen,
  onClose,
}: Props) {
  if (citizen) {
    return (
      <CitizenInspector
        citizen={citizen}
        runtime={citizenRuntime ?? null}
        onSelectBuildingById={onSelectBuildingById}
        onClose={onClose}
      />
    );
  }
  return (
    <BuildingInspector
      building={building}
      occupants={buildingOccupants ?? []}
      onSelectCitizen={onSelectCitizen}
      onClose={onClose}
    />
  );
}

function BuildingInspector({
  building,
  occupants,
  onSelectCitizen,
  onClose,
}: {
  building: EidolonBuilding | null;
  occupants: EidolonCitizen[];
  onSelectCitizen?: (citizenId: string) => void;
  onClose?: () => void;
}) {
  if (!building) {
    return (
      <div className="glass-card p-4 text-xs text-gray-400">
        Click any building or citizen to inspect it. Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">Esc</kbd> to clear.
      </div>
    );
  }
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            {KIND_LABEL[building.kind] ?? building.kind} · {building.district}
          </div>
          <div className="text-sm font-semibold text-gray-100">{building.label}</div>
        </div>
        <div className="flex items-start gap-2">
          <span className={STATUS_CLASS[building.status]}>{building.status}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="close inspector"
              className="text-gray-500 hover:text-gray-200 text-xs leading-none px-1"
            >
              ✕
            </button>
          )}
        </div>
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
      {occupants.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            occupants · {occupants.length}
          </div>
          <ul className="flex flex-wrap gap-1">
            {occupants.map((c) => {
              const Tag = onSelectCitizen ? 'button' : 'span';
              return (
                <li key={c.id}>
                  <Tag
                    {...(onSelectCitizen
                      ? {
                          type: 'button' as const,
                          onClick: () => onSelectCitizen(c.id),
                          'aria-label': `inspect ${c.label}`,
                        }
                      : {})}
                    className={`text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-200 max-w-[10rem] truncate ${
                      onSelectCitizen
                        ? 'cursor-pointer hover:bg-brand-500/20 hover:text-gray-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-400'
                        : ''
                    }`}
                    title={c.label}
                  >
                    {c.label}
                  </Tag>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="text-[10px] font-mono text-gray-500 break-all">{building.id}</div>
    </div>
  );
}

function CitizenInspector({
  citizen,
  runtime,
  onSelectBuildingById,
  onClose,
}: {
  citizen: EidolonCitizen;
  runtime: EidolonAgentRuntimeSlim | null;
  onSelectBuildingById?: (buildingId: string) => void;
  onClose?: () => void;
}) {
  const energyPct = runtime ? Math.max(0, Math.min(100, Math.round(runtime.energy))) : null;
  const energyColor =
    energyPct == null
      ? 'bg-white/10'
      : energyPct >= 66
      ? 'bg-emerald-400'
      : energyPct >= 33
      ? 'bg-amber-400'
      : 'bg-rose-500';

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            citizen · {citizen.role}
            {citizen.archetype ? ` · ${citizen.archetype}` : ''}
          </div>
          <div className="text-sm font-semibold text-gray-100 truncate" title={citizen.label}>
            {runtime ? `${MOOD_EMOJI[runtime.mood] ?? ''} ` : ''}
            {citizen.label}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className={CITIZEN_STATUS_CLASS[citizen.status]}>{citizen.status}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="close inspector"
              className="text-gray-500 hover:text-gray-200 text-xs leading-none px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {runtime && energyPct != null && (
        <div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            <span>energy</span>
            <span className="text-gray-300">{energyPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded bg-white/5 overflow-hidden">
            <div
              className={`h-full ${energyColor} transition-[width] duration-500`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 text-xs">
        {runtime && (
          <Stat label="State" value={RUNTIME_STATE_LABEL[runtime.state] ?? runtime.state} />
        )}
        {runtime?.targetLocation && (
          <Stat label="Heading to" value={runtime.targetLocation} />
        )}
        {runtime && <Stat label="Mood" value={runtime.mood} />}
        <Stat label="Earnings" value={`$${citizen.earningsUsd.toFixed(2)}`} />
        {citizen.homeBuildingId && (
          <HomeStat
            buildingId={citizen.homeBuildingId}
            onSelect={onSelectBuildingById}
          />
        )}
      </dl>

      {citizen.specializations && citizen.specializations.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            specializations
          </div>
          <div className="flex flex-wrap gap-1">
            {citizen.specializations.slice(0, 6).map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {citizen.bio && (
        <div className="text-[11px] leading-snug text-gray-400 line-clamp-3" title={citizen.bio}>
          {citizen.bio}
        </div>
      )}

      <div className="text-[10px] font-mono text-gray-500 break-all">{citizen.id}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-100 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

// Clickable variant of Stat for the citizen "Home" cross-link. Falls back to a
// plain Stat when no callback is wired so the panel is still usable in a
// read-only context.
function HomeStat({
  buildingId,
  onSelect,
}: {
  buildingId: string;
  onSelect?: (buildingId: string) => void;
}) {
  if (!onSelect) return <Stat label="Home" value={buildingId} />;
  return (
    <button
      type="button"
      onClick={() => onSelect(buildingId)}
      className="text-left rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 min-w-0 hover:bg-brand-500/15 hover:border-brand-400/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 transition-colors group"
      aria-label={`select home building ${buildingId}`}
      title={`jump to ${buildingId}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500 group-hover:text-brand-300">
        Home →
      </div>
      <div className="text-sm text-gray-100 truncate">{buildingId}</div>
    </button>
  );
}

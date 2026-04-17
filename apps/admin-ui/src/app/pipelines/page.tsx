'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-zinc-400',
  active: 'bg-emerald-400',
  paused: 'bg-amber-400',
  archived: 'bg-zinc-600',
};

const TYPE_LABEL: Record<string, string> = {
  service_marketplace: 'Service',
  product_deployment: 'Product',
  content_creation: 'Content',
  merchandise: 'Merch',
  custom: 'Custom',
};

function statusBadge(s: string) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[s] ?? 'bg-zinc-500'}`} />
      {s}
    </span>
  );
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return new Date(String(v)).toLocaleString();
  } catch {
    return String(v);
  }
}

function isSeed(p: Record<string, unknown>): boolean {
  const cfg = (p.config as Record<string, unknown>) ?? {};
  const tc = (cfg.typeConfig as Record<string, unknown>) ?? {};
  return tc.seed === true;
}

export default function PipelinesPage() {
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['revenuePipelines', 'list'],
    queryFn: () => api.revenuePipelines.list(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const seedQ = useQuery({
    queryKey: ['revenuePipelines', 'seedSummary'],
    queryFn: () => api.revenuePipelines.seedSummary(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const activateM = useMutation({
    mutationFn: (id: string) => api.revenuePipelines.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['revenuePipelines'] }),
  });

  const pauseM = useMutation({
    mutationFn: (id: string) => api.revenuePipelines.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['revenuePipelines'] }),
  });

  if (listQ.isLoading || seedQ.isLoading) return <PageSpinner />;

  const pipelines = (listQ.data?.data?.pipelines ?? []) as Array<Record<string, unknown>>;
  const seed = seedQ.data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Pipelines"
        description="Seed pipelines provisioned on automaton birth. Each active pipeline tracks revenue events and feeds treasury."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Seed Pipelines" value={String(seed?.seedPipelines ?? 0)} />
        <StatCard label="Total Active" value={String(seed?.totalActive ?? 0)} />
        <StatCard label="24h Net Revenue" value={fmtUsd(seed?.last24hNet ?? 0)} />
        <StatCard label="24h Events" value={String(seed?.last24hEvents ?? 0)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Seed</th>
              <th className="px-3 py-2 font-medium">Last Revenue</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  No revenue pipelines yet. Birth an automaton to auto-provision one.
                </td>
              </tr>
            )}
            {pipelines.map((p) => {
              const status = String(p.status ?? 'draft');
              const id = String(p.id);
              return (
                <tr key={id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{id.slice(0, 16)}…</td>
                  <td className="px-3 py-2 max-w-[200px] truncate">{String(p.name ?? '—')}</td>
                  <td className="px-3 py-2 text-xs">{TYPE_LABEL[String(p.type)] ?? String(p.type)}</td>
                  <td className="px-3 py-2">{statusBadge(status)}</td>
                  <td className="px-3 py-2 text-xs">{isSeed(p) ? '🌱' : '—'}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{fmtDate(p.last_revenue_at)}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{fmtDate(p.created_at)}</td>
                  <td className="px-3 py-2">
                    {(status === 'draft' || status === 'paused') && (
                      <button
                        onClick={() => activateM.mutate(id)}
                        disabled={activateM.isPending}
                        className="text-xs px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 mr-1"
                      >
                        Activate
                      </button>
                    )}
                    {status === 'active' && (
                      <button
                        onClick={() => pauseM.mutate(id)}
                        disabled={pauseM.isPending}
                        className="text-xs px-2 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300"
                      >
                        Pause
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Seed pipelines (🌱) are auto-provisioned when an automaton is born. They earn via the
        marketplace at <code className="mx-1 px-1 py-0.5 bg-white/10 rounded">market.sven.systems</code>.
        All revenue flows through treasury ledger accounts.
      </p>
    </div>
  );
}

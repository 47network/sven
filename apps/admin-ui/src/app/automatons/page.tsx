'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';

const STATUS_DOT: Record<string, string> = {
  born: 'bg-blue-400',
  working: 'bg-emerald-400',
  cloning: 'bg-cyan-400',
  retiring: 'bg-amber-400',
  dead: 'bg-zinc-500',
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

export default function AutomatonsPage() {
  const listQ = useQuery({
    queryKey: ['automatons', 'list'],
    queryFn: () => api.automatons.list({ limit: 200 }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const summaryQ = useQuery({
    queryKey: ['automatons', 'summary'],
    queryFn: () => api.automatons.summary(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  if (listQ.isLoading || summaryQ.isLoading) return <PageSpinner />;

  const automatons = (listQ.data?.data?.automatons ?? []) as Array<Record<string, unknown>>;
  const summary = summaryQ.data?.data;
  const counts = summary?.counts ?? { born: 0, working: 0, cloning: 0, retiring: 0, dead: 0 };
  const revenue = Number(summary?.totalRevenueUsd ?? 0);
  const cost = Number(summary?.totalCostUsd ?? 0);
  const net = revenue - cost;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Autonomous Automatons"
        description="Sven's self-replicating workers: born with a wallet, earn their keep, or retire."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Born" value={String(counts.born ?? 0)} />
        <StatCard label="Working" value={String(counts.working ?? 0)} />
        <StatCard label="Cloning" value={String(counts.cloning ?? 0)} />
        <StatCard label="Retiring" value={String(counts.retiring ?? 0)} />
        <StatCard label="Dead" value={String(counts.dead ?? 0)} />
        <StatCard label="Lifetime Revenue" value={fmtUsd(revenue)} />
        <StatCard label="Lifetime Cost" value={fmtUsd(cost)} />
        <StatCard label="Net" value={fmtUsd(net)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Gen</th>
              <th className="px-3 py-2 font-medium">Parent</th>
              <th className="px-3 py-2 font-medium">Revenue</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">ROI</th>
              <th className="px-3 py-2 font-medium">Pipelines</th>
              <th className="px-3 py-2 font-medium">Born</th>
            </tr>
          </thead>
          <tbody>
            {automatons.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
                  No automatons yet. Enable lifecycle scheduler with
                  <code className="mx-1 px-1 py-0.5 bg-white/10 rounded">SVEN_LIFECYCLE_ENABLED=1</code>
                  on agent-runtime.
                </td>
              </tr>
            )}
            {automatons.map((a) => {
              const metrics = (a.metrics ?? {}) as Record<string, unknown>;
              const rev = Number(metrics.lifetimeRevenueUsd ?? 0);
              const cst = Number(metrics.lifetimeCostUsd ?? 0);
              const roi = cst > 0 ? ((rev - cst) / cst) * 100 : rev > 0 ? Infinity : 0;
              const pipelines = (a.pipelineIds ?? []) as string[];
              return (
                <tr key={String(a.id)} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{String(a.id).slice(0, 12)}…</td>
                  <td className="px-3 py-2">{statusBadge(String(a.status))}</td>
                  <td className="px-3 py-2">{String(a.generation ?? 0)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                    {a.parentId ? String(a.parentId).slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-3 py-2">{fmtUsd(rev)}</td>
                  <td className="px-3 py-2">{fmtUsd(cst)}</td>
                  <td className="px-3 py-2">
                    {Number.isFinite(roi) ? roi.toFixed(1) + '%' : '∞'}
                  </td>
                  <td className="px-3 py-2">{pipelines.length}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{fmtDate(a.bornAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Automatons are born with a treasury account + wallet, run a revenue pipeline, and are
        promoted, put on probation, or retired based on ROI. Eidolon city visualizes them in 3D at{' '}
        <a href="https://eidolon.sven.systems" className="underline" target="_blank" rel="noreferrer">
          eidolon.sven.systems
        </a>
        .
      </p>
    </div>
  );
}

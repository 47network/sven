'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ActiveAccountPill } from '@/components/ActiveAccountPill';
import { useMe, useToolRuns } from '@/lib/hooks';
import { Play, CheckCircle2, XCircle, Clock, Sparkles, ArrowUpRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import Link from 'next/link';

type ToolRunRow = {
  id: string;
  status: string;
  tool_name: string;
  duration_ms?: number | null;
  chat_id?: string | null;
  started_at?: string | null;
};

export default function RunsPage() {
  const { data: me } = useMe();
  const activeAccountName = me?.active_organization_name || me?.active_organization_slug || 'active account';
  const [filter, setFilter] = useState({ tool_name: '', status: '' });
  const [sortBy, setSortBy] = useState<'started_desc' | 'started_asc' | 'duration_desc'>('started_desc');
  const { data, isLoading } = useToolRuns({
    tool_name: filter.tool_name || undefined,
    status: filter.status || undefined,
    limit: 100,
  });
  const rows = (data?.rows ?? []) as ToolRunRow[];
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortBy === 'duration_desc') return Number(b.duration_ms || 0) - Number(a.duration_ms || 0);
      const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
      const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
      return sortBy === 'started_desc' ? tb - ta : ta - tb;
    });
  }, [rows, sortBy]);
  const successCount = rows.filter((r) => r.status === 'success').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;
  const runningCount = rows.filter((r) => r.status === 'running' || r.status === 'pending').length;

  if (isLoading) return <PageSpinner />;

  function statusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
    }
  }

  return (
    <>
      <PageHeader title="Tool Runs" description="Execution logs and artifacts for all tool invocations">
        <ActiveAccountPill />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Runtime Telemetry
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Execution Stream</h2>
              <p className="mt-1 text-sm text-slate-400">
                Real-time tool execution outcomes for {activeAccountName}.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Success</p>
              <p className="text-lg font-semibold text-emerald-300">{successCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Errors</p>
              <p className="text-lg font-semibold text-red-300">{errorCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Active</p>
              <p className="text-lg font-semibold text-amber-300">{runningCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/trace-view" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Trace View</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/incidents" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Incident Center</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/approvals" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Approvals</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          className="input w-52"
          placeholder="Filter by tool name…"
          value={filter.tool_name}
          onChange={(e) => setFilter({ ...filter, tool_name: e.target.value })}
        />
        <select
          className="input w-40"
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="running">Running</option>
          <option value="pending">Pending</option>
        </select>
        <span className="inline-flex items-center rounded-full border border-slate-700/60 px-2.5 py-1 text-xs text-slate-400">
          Scoped to {activeAccountName}
        </span>
        <select
          className="input w-44"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'started_desc' | 'started_asc' | 'duration_desc')}
        >
          <option value="started_desc">Sort: Newest</option>
          <option value="started_asc">Sort: Oldest</option>
          <option value="duration_desc">Sort: Longest run</option>
        </select>
        <span className="badge badge-neutral">{sortedRows.length} shown</span>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState
          icon={Play}
          title="No tool runs"
          description={`No tool executions in ${activeAccountName} yet.`}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border hover-lift">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Tool</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Chat</th>
                <th className="px-4 py-3 text-left font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      {statusIcon(r.status)}
                      <span
                        className={
                          r.status === 'success'
                            ? 'text-green-700 dark:text-green-400'
                            : r.status === 'error'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                        }
                      >
                        {r.status}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium font-mono text-xs">{r.tool_name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.duration_ms ? `${r.duration_ms}ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.chat_id?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

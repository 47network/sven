'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useInfraProposals,
  useApproveInfraProposal,
} from '@/lib/hooks';
import { toast } from 'sonner';

/* ── helpers ── */
function safe<T>(d: unknown, key: string): T { return ((d as Record<string, unknown>)?.[key] ?? []) as T; }
function fmtUsd(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n); }

const STATUS_COLORS: Record<string, string> = {
  awaiting_approval: 'bg-amber-500/20 text-amber-300',
  pending_approval: 'bg-amber-500/20 text-amber-300',
  pending: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  denied: 'bg-red-500/20 text-red-300',
  executed: 'bg-cyan-500/20 text-cyan-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  draft: 'bg-zinc-500/20 text-zinc-300',
  rejected: 'bg-red-500/20 text-red-300',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-amber-500/20 text-amber-300',
  high: 'bg-red-500/20 text-red-300',
};

interface UnifiedProposal {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  risk?: string;
  expectedBenefit?: string;
  costDelta?: number;
  proposalType?: string;
  createdAt: string;
}

export default function ProposalsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const infraProposalsQ = useInfraProposals();
  const approveInfra = useApproveInfraProposal();

  if (infraProposalsQ.isLoading) return <PageSpinner />;

  const rawInfra = safe<Array<Record<string, unknown>>>((infraProposalsQ.data as Record<string, unknown>)?.data, 'proposals');

  /* ── unify proposals ── */
  const infraItems: UnifiedProposal[] = rawInfra.map((p) => ({
    id: String(p.id),
    title: String(p.title ?? 'Untitled'),
    description: String(p.description ?? ''),
    amount: Number(p.cost_delta ?? 0),
    status: String(p.status ?? 'draft'),
    risk: String(p.risk_level ?? ''),
    expectedBenefit: String(p.expected_benefit ?? ''),
    costDelta: Number(p.cost_delta ?? 0),
    proposalType: String(p.proposal_type ?? ''),
    createdAt: String(p.created_at ?? ''),
  }));

  const all: UnifiedProposal[] = [...infraItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = filter === 'all' ? all
    : filter === 'pending' ? all.filter((p) => ['awaiting_approval', 'pending_approval', 'pending'].includes(p.status))
    : filter === 'approved' ? all.filter((p) => ['approved', 'executed', 'completed'].includes(p.status))
    : all.filter((p) => ['denied', 'rejected'].includes(p.status));

  const pendingCount = all.filter((p) => ['awaiting_approval', 'pending_approval', 'pending'].includes(p.status)).length;
  const approvedCount = all.filter((p) => ['approved', 'executed', 'completed'].includes(p.status)).length;
  const totalAmount = all.reduce((s, p) => s + Math.abs(p.amount), 0);

  function handleApprove(p: UnifiedProposal) {
    approveInfra.mutate(p.id, { onSuccess: () => toast.success('Proposal approved'), onError: () => toast.error('Failed to approve') });
  }

  const isPending = (s: string) => ['awaiting_approval', 'pending_approval', 'pending'].includes(s);
  const FILTERS = ['all', 'pending', 'approved', 'denied'] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Infrastructure Proposals" description="Infrastructure spending and change proposals" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Proposals" value={String(all.length)} />
        <StatCard label="Pending Approval" value={String(pendingCount)} valueClassName={pendingCount > 0 ? 'text-amber-400' : ''} />
        <StatCard label="Approved" value={String(approvedCount)} valueClassName="text-emerald-400" />
        <StatCard label="Total Amount" value={fmtUsd(totalAmount)} />
      </div>

      {/* filter pills */}
      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'pending' && pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* proposals list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-4 text-zinc-500 text-sm">No proposals match this filter</div>
        ) : (
          filtered.map((p) => {
            const isExpanded = expandedId === p.id;
            return (
              <div key={p.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Infra
                    </span>
                    <h4 className="font-semibold">{p.title}</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{p.amount >= 0 ? '+' : ''}{fmtUsd(p.amount)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[p.status] ?? 'bg-zinc-500/20 text-zinc-300'}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                    {p.description && <p className="text-sm text-zinc-300">{p.description}</p>}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {p.proposalType && <div><span className="text-zinc-400">Type:</span> <span className="badge-info text-xs">{p.proposalType}</span></div>}
                      {p.risk && (
                        <div>
                          <span className="text-zinc-400">Risk:</span>{' '}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${RISK_COLORS[p.risk] ?? 'bg-zinc-500/20 text-zinc-300'}`}>{p.risk}</span>
                        </div>
                      )}
                      {p.expectedBenefit && <div className="col-span-2"><span className="text-zinc-400">Benefit:</span> {p.expectedBenefit}</div>}
                      {p.costDelta !== undefined && (
                        <div><span className="text-zinc-400">Cost Delta:</span> <span className={p.costDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}>{fmtUsd(p.costDelta)}/mo</span></div>
                      )}
                      <div><span className="text-zinc-400">Created:</span> {new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>

                    {/* action buttons */}
                    {isPending(p.status) && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          className="btn-primary"
                          onClick={() => handleApprove(p)}
                          disabled={approveInfra.isPending}
                        >
                          ✓ Approve
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

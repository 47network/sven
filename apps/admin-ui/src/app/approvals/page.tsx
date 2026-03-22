'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ActiveAccountPill } from '@/components/ActiveAccountPill';
import { useApprovals, useMe, useVoteApproval } from '@/lib/hooks';
import { ShieldCheck, CheckCircle2, XCircle, Clock, History, Sparkles, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

type Tab = 'pending' | 'history';
type ApprovalRow = {
  id: string;
  type: string;
  title?: string | null;
  status: string;
  requester?: string | null;
  created_at: string;
  decided_by?: string | null;
  decided_at?: string | null;
  details?: {
    last_vote_reason?: string | null;
  } | null;
};

export default function ApprovalsPage() {
  const { data: me } = useMe();
  const activeAccountName = me?.active_organization_name || me?.active_organization_slug || 'active account';
  const [tab, setTab] = useState<Tab>('pending');
  const [localAudit, setLocalAudit] = useState<
    Array<{ at: string; approval_id: string; decision: 'approve' | 'deny'; reason: string }>
  >([]);
  const { data: pending, isLoading: pLoading } = useApprovals('pending');
  const { data: history, isLoading: hLoading } = useApprovals();
  const vote = useVoteApproval();

  const isLoading = pLoading || hLoading;
  if (isLoading) return <PageSpinner />;

  const pendingRows = (pending?.rows ?? []) as ApprovalRow[];
  const historyRows = ((history?.rows ?? []) as ApprovalRow[]).filter((r) => r.status !== 'pending');

  function handleVote(id: string, decision: 'approve' | 'deny') {
    const confirmPhrase = `${decision.toUpperCase()} ${id.slice(0, 6)}`;
    const typed = window.prompt(
      `High-risk action. Type "${confirmPhrase}" to continue:`,
      '',
    );
    if (typed !== confirmPhrase) {
      toast.error('Confirmation phrase mismatch. Vote canceled.');
      return;
    }
    const reason = window.prompt('Audit reason (required):', '')?.trim() || '';
    if (!reason) {
      toast.error('Audit reason is required.');
      return;
    }

    vote.mutate(
      { id, decision, reason, confirmPhrase: confirmPhrase },
      {
        onSuccess: () => {
          setLocalAudit((prev) => [
            { at: new Date().toISOString(), approval_id: id, decision, reason },
            ...prev,
          ].slice(0, 12));
          toast.success(`Approval ${decision}d`);
        },
        onError: () => toast.error('Vote failed'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Approvals" description="Pending approvals and action history">
        <ActiveAccountPill />
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Governance Gate
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Approval Command Desk</h2>
              <p className="mt-1 text-sm text-slate-400">
                High-risk actions require explicit confirmation phrase and audit reason.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Pending</div>
              <div className="text-xl font-semibold text-cyan-300">{pendingRows.length}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/incidents" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Incident Center</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/trace-view" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Trace View</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/runs" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Tool Runs</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Clock className="mr-1 inline h-3.5 w-3.5" /> Pending ({pendingRows.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'history' ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <History className="mr-1 inline h-3.5 w-3.5" /> History ({historyRows.length})
        </button>
      </div>

      {tab === 'pending' && (
        <>
          {pendingRows.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All clear"
              description={`No pending approvals for ${activeAccountName}.`}
            />
          ) : (
            <div className="space-y-3">
              {pendingRows.map((a) => (
                <div key={a.id} className="card flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">
                      {a.title ?? a.type}{' '}
                      <span className="badge badge-neutral text-[10px]">{activeAccountName}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.type} &middot; {a.requester ?? 'system'} &middot;{' '}
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVote(a.id, 'approve')}
                      disabled={vote.isPending}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleVote(a.id, 'deny')}
                      disabled={vote.isPending}
                      className="btn-danger btn-sm flex items-center gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {localAudit.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-slate-50 p-4 dark:bg-slate-900/40">
              <p className="mb-2 text-sm font-semibold">Recent action confirmations</p>
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {localAudit.map((a, idx) => (
                  <p key={`${a.approval_id}-${idx}`}>
                    {new Date(a.at).toLocaleString()} · {a.approval_id.slice(0, 8)} · {a.decision} · {a.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
          {historyRows.length === 0 ? (
            <EmptyState
              icon={History}
              title="No history"
              description={`No completed approvals for ${activeAccountName} yet.`}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">Decision</th>
                    <th className="px-4 py-3 text-left font-medium">Reason</th>
                    <th className="px-4 py-3 text-left font-medium">By</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyRows.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">{a.type}</td>
                      <td className="px-4 py-3 font-medium">{a.title ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={a.status === 'approved' ? 'badge-success' : 'badge-danger'}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{a?.details?.last_vote_reason ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{a.decided_by ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {a.decided_at ? new Date(a.decided_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

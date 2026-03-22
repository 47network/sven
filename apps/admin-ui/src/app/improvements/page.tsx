'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useImprovements, useApproveImprovement, useDismissImprovement } from '@/lib/hooks';
import { Lightbulb, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Improvement = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  confidence?: number;
  status?: string;
  decided_at?: string;
};

export default function ImprovementsPage() {
  const { data, isLoading } = useImprovements();
  const approve = useApproveImprovement();
  const dismiss = useDismissImprovement();

  if (isLoading) return <PageSpinner />;

  const rows: Improvement[] = Array.isArray(data?.rows)
    ? (data.rows as Array<Record<string, unknown>>)
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : '',
          title: typeof row.title === 'string' ? row.title : undefined,
          description: typeof row.description === 'string' ? row.description : undefined,
          category: typeof row.category === 'string' ? row.category : undefined,
          confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
          status: typeof row.status === 'string' ? row.status : undefined,
          decided_at: typeof row.decided_at === 'string' ? row.decided_at : undefined,
        }))
        .filter((row) => row.id.length > 0)
    : [];
  const pending = rows.filter((r) => r.status === 'pending');
  const applied = rows.filter((r) => r.status !== 'pending');

  function handleApprove(id: string) {
    approve.mutate(id, {
      onSuccess: () => toast.success('Improvement approved'),
      onError: () => toast.error('Failed to approve'),
    });
  }

  function handleDismiss(id: string) {
    dismiss.mutate(id, {
      onSuccess: () => toast.success('Improvement dismissed'),
      onError: () => toast.error('Failed to dismiss'),
    });
  }

  return (
    <>
      <PageHeader title="Improvements" description="Self-improvement suggestions from Sven" />

      {rows.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No improvements yet"
          description="Sven will suggest improvements based on usage patterns and errors."
        />
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">Pending ({pending.length})</h2>
              <div className="space-y-3">
                {pending.map((imp) => (
                  <div key={imp.id} className="card py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          <Lightbulb className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{imp.title ?? 'improvement'}</p>
                          <p className="mt-0.5 text-sm text-slate-500">{imp.description ?? '—'}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {imp.category ?? 'general'} &middot; confidence: {imp.confidence ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(imp.id)}
                          disabled={approve.isPending}
                          className="btn-primary btn-sm flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleDismiss(imp.id)}
                          disabled={dismiss.isPending}
                          className="btn-ghost btn-sm text-slate-400"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">History ({applied.length})</h2>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Title</th>
                      <th className="px-4 py-3 text-left font-medium">Category</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {applied.map((imp) => (
                      <tr key={imp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium">{imp.title ?? 'improvement'}</td>
                        <td className="px-4 py-3 text-slate-500">{imp.category ?? 'general'}</td>
                        <td className="px-4 py-3">
                          <span className={imp.status === 'approved' ? 'badge-success' : 'badge-neutral'}>
                            {imp.status ?? 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {imp.decided_at ? new Date(imp.decided_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

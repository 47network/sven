'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useModelRollouts, useUpdateModelRollout } from '@/lib/hooks';
import { GitBranch, RotateCcw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type RolloutRow = {
  id: string;
  name: string;
  source_model: string;
  target_model: string;
  status: string;
  percentage: number;
  error_rate: string;
  p95_latency_ms: number | null;
  rollback_threshold: string;
};

function toRolloutRows(value: unknown): RolloutRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Unnamed rollout'),
      source_model: String((item.metrics as Record<string, unknown> | undefined)?.source_model ?? 'baseline'),
      target_model: String(item.target_model ?? item.model_id ?? 'unknown'),
      status: String(item.status ?? 'unknown'),
      percentage: Number(item.percentage ?? item.traffic_pct ?? 0),
      error_rate: String((item.metrics as Record<string, unknown> | undefined)?.error_rate ?? '—'),
      p95_latency_ms: typeof (item.metrics as Record<string, unknown> | undefined)?.p95_latency_ms === 'number'
        ? ((item.metrics as Record<string, unknown>).p95_latency_ms as number)
        : null,
      rollback_threshold: String((item.metrics as Record<string, unknown> | undefined)?.rollback_threshold ?? '5%'),
    }));
}

export default function CanaryRolloutsPage() {
  const { data, isLoading } = useModelRollouts();
  const updateRollout = useUpdateModelRollout();

  if (isLoading) return <PageSpinner />;

  const rows = toRolloutRows(data?.rows);

  function handleRollback(id: string) {
    updateRollout.mutate(
      {
        id,
        data: {
          status: 'rolled_back',
          traffic_pct: 0,
        },
      },
      {
        onSuccess: () => toast.success('Rollback triggered'),
        onError: () => toast.error('Rollback failed'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Canary Rollouts" description="Gradual model rollout with automatic rollback triggers" />

      {rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No active rollouts"
          description="Create a canary rollout to gradually shift traffic between model versions."
        />
      ) : (
        <div className="space-y-4">
          {rows.map((rollout) => (
            <div key={rollout.id} className="card py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-lg">{rollout.name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {rollout.source_model} <ChevronRight className="inline h-3 w-3" /> {rollout.target_model}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      rollout.status === 'active'
                        ? 'badge-warning'
                        : rollout.status === 'completed'
                          ? 'badge-success'
                          : 'badge-danger'
                    }
                  >
                    {rollout.status}
                  </span>
                  {rollout.status === 'active' && (
                    <button
                      className="btn-danger btn-sm flex items-center gap-1"
                      title="Rollback"
                      onClick={() => handleRollback(rollout.id)}
                      disabled={updateRollout.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Rollback
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-500">Traffic split</span>
                  <span className="font-medium">{rollout.percentage ?? 0}% to target</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${rollout.percentage ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Error rate</p>
                  <p className="font-medium">{rollout.error_rate ?? '0%'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Latency (p95)</p>
                  <p className="font-medium">{rollout.p95_latency_ms ? `${rollout.p95_latency_ms}ms` : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Rollback threshold</p>
                  <p className="font-medium">{rollout.rollback_threshold ?? '5%'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

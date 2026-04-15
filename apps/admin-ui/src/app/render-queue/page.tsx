'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useVideoJobs,
  useVideoJob,
  useCancelVideoJob,
  useVideoStats,
} from '@/lib/hooks';
import { toast } from 'sonner';

/* ── helpers ── */
function safe<T>(d: unknown, key: string): T { return ((d as Record<string, unknown>)?.[key] ?? []) as T; }
function fmtDuration(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }
function fmtBytes(b: number) { if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`; if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`; return `${(b / 1073741824).toFixed(1)} GB`; }

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  rendering: 'bg-blue-500/20 text-blue-300 animate-pulse',
  completed: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-zinc-500/20 text-zinc-300',
};

const STATUS_FILTERS = ['all', 'pending', 'rendering', 'completed', 'failed', 'cancelled'] as const;

export default function RenderQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const jobsQ = useVideoJobs({ limit: 50, status: statusFilter === 'all' ? undefined : statusFilter });
  const statsQ = useVideoStats();
  const jobDetailQ = useVideoJob(selectedJobId ?? '');
  const cancelJob = useCancelVideoJob();

  if (jobsQ.isLoading || statsQ.isLoading) return <PageSpinner />;

  const jobs = safe<Array<Record<string, unknown>>>(jobsQ.data, 'jobs');
  const stats = statsQ.data as Record<string, unknown> | undefined;

  const totalJobs = Number(stats?.total_jobs ?? 0);
  const rendering = Number(stats?.rendering ?? 0);
  const completed = Number(stats?.completed ?? 0);
  const failed = Number(stats?.failed ?? 0);
  const pending = Number(stats?.pending ?? 0);
  const avgRenderTime = Number(stats?.avg_render_time_ms ?? 0);
  const totalBytes = Number(stats?.total_output_bytes ?? 0);
  const totalVideoSecs = Number(stats?.total_video_secs ?? 0);

  const jobDetail = selectedJobId ? (jobDetailQ.data as Record<string, unknown>) : null;

  function handleCancel(id: string) {
    cancelJob.mutate(id, {
      onSuccess: () => toast.success('Job cancelled'),
      onError: () => toast.error('Failed to cancel job'),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Render Queue" description="Video rendering jobs and queue monitor" />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard label="Total Jobs" value={String(totalJobs)} />
        <StatCard label="Rendering" value={String(rendering)} valueClassName={rendering > 0 ? 'text-blue-400' : ''} />
        <StatCard label="Pending" value={String(pending)} valueClassName={pending > 0 ? 'text-amber-400' : ''} />
        <StatCard label="Completed" value={String(completed)} valueClassName="text-emerald-400" />
        <StatCard label="Failed" value={String(failed)} valueClassName={failed > 0 ? 'text-red-400' : ''} />
        <StatCard label="Avg Render" value={fmtDuration(avgRenderTime)} />
        <StatCard label="Total Output" value={fmtBytes(totalBytes)} />
      </div>

      {/* status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button key={s} className={statusFilter === s ? 'btn-primary' : 'btn-secondary'} onClick={() => { setStatusFilter(s); setSelectedJobId(null); }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* job list */}
        <div className="md:col-span-2 space-y-2">
          {jobs.length === 0 ? (
            <div className="card p-4 text-zinc-500 text-sm">No render jobs{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}</div>
          ) : (
            jobs.map((j) => {
              const isSelected = selectedJobId === String(j.id);
              const progress = Number(j.progress ?? 0);
              return (
                <div
                  key={String(j.id)}
                  className={`card p-3 cursor-pointer transition-all ${isSelected ? 'ring-1 ring-cyan-500/50' : 'hover:bg-white/5'}`}
                  onClick={() => setSelectedJobId(isSelected ? null : String(j.id))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${STATUS_COLORS[String(j.status)] ?? 'bg-zinc-500/20 text-zinc-300'}`}>
                        {String(j.status)}
                      </span>
                      <span className="font-medium truncate">{String(j.title ?? 'Untitled')}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {String(j.template) && <span className="badge-info text-xs">{String(j.template)}</span>}
                      <span className="text-xs text-zinc-400">{Number(j.width ?? 0)}×{Number(j.height ?? 0)}</span>
                      <span className="text-xs text-zinc-500">{new Date(String(j.created_at)).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* progress bar for rendering jobs */}
                  {String(j.status) === 'rendering' && (
                    <div className="mt-2 w-full h-1.5 rounded bg-white/10">
                      <div className="h-full rounded bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}

                  {/* duration info */}
                  <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                    {Number(j.duration_secs) > 0 && <span>Duration: {Number(j.duration_secs).toFixed(1)}s</span>}
                    {Number(j.render_time_ms) > 0 && <span>Render: {fmtDuration(Number(j.render_time_ms))}</span>}
                    <span>{String(j.output_format ?? 'mp4').toUpperCase()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* detail panel */}
        <div className="space-y-3">
          {selectedJobId && jobDetail ? (
            <div className="card p-4 space-y-3 sticky top-4">
              <h3 className="text-sm font-semibold text-zinc-300">Job Detail</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-zinc-400">ID:</span> <span className="font-mono text-xs">{String(jobDetail.id)}</span></div>
                <div><span className="text-zinc-400">Title:</span> {String(jobDetail.title ?? 'Untitled')}</div>
                <div><span className="text-zinc-400">Template:</span> {String(jobDetail.template ?? '-')}</div>
                <div><span className="text-zinc-400">Status:</span>{' '}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_COLORS[String(jobDetail.status)] ?? 'bg-zinc-500/20 text-zinc-300'}`}>
                    {String(jobDetail.status)}
                  </span>
                </div>
                <div><span className="text-zinc-400">Resolution:</span> {Number(jobDetail.width ?? 0)}×{Number(jobDetail.height ?? 0)} @ {Number(jobDetail.fps ?? 30)}fps</div>
                <div><span className="text-zinc-400">Format:</span> {String(jobDetail.output_format ?? 'mp4').toUpperCase()}</div>
                <div><span className="text-zinc-400">Duration:</span> {Number(jobDetail.duration_secs ?? 0).toFixed(1)}s</div>
                {Number(jobDetail.render_time_ms) > 0 ? <div><span className="text-zinc-400">Render Time:</span> {fmtDuration(Number(jobDetail.render_time_ms))}</div> : null}
                {jobDetail.started_at ? <div><span className="text-zinc-400">Started:</span> {new Date(String(jobDetail.started_at)).toLocaleString()}</div> : null}
                {jobDetail.completed_at ? <div><span className="text-zinc-400">Completed:</span> {new Date(String(jobDetail.completed_at)).toLocaleString()}</div> : null}
                <div><span className="text-zinc-400">Created:</span> {new Date(String(jobDetail.created_at)).toLocaleString()}</div>
              </div>

              {/* spec preview */}
              {jobDetail.spec ? (
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 mb-1">Spec</h4>
                  <pre className="bg-black/30 rounded p-2 text-xs font-mono text-zinc-300 overflow-auto max-h-40">
                    {JSON.stringify(jobDetail.spec, null, 2)}
                  </pre>
                </div>
              ) : null}

              {/* cancel button */}
              {['pending', 'rendering'].includes(String(jobDetail.status)) && (
                <button
                  className="btn-danger w-full"
                  onClick={() => handleCancel(String(jobDetail.id))}
                  disabled={cancelJob.isPending}
                >
                  Cancel Job
                </button>
              )}
            </div>
          ) : (
            <div className="card p-4 text-zinc-500 text-sm">
              Select a job to view details
            </div>
          )}

          {/* queue summary */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">Queue Summary</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-zinc-400">Total video</span> <span className="font-mono">{(totalVideoSecs / 60).toFixed(1)} min</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Total output</span> <span className="font-mono">{fmtBytes(totalBytes)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Avg render time</span> <span className="font-mono">{fmtDuration(avgRenderTime)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Success rate</span> <span className="font-mono">{totalJobs > 0 ? ((completed / totalJobs) * 100).toFixed(1) : 0}%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

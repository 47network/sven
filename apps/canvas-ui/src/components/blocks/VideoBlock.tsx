'use client';

import { Film, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoJob, useCancelVideoJob } from '@/lib/hooks';

/**
 * E.3.2 — Video preview player block.
 * Renders video job status + playback. Shows progress while rendering,
 * plays completed video via HTML5 <video> element.
 */

type VideoContent = {
  job_id?: string;
  url?: string;
  status?: string;
  progress?: number;
  prompt?: string;
  duration_s?: number;
  error?: string;
};

function safe(content: unknown): VideoContent {
  if (content && typeof content === 'object') return content as VideoContent;
  return {};
}

export function VideoBlock({
  content,
}: {
  content: unknown;
  metadata?: Record<string, unknown>;
}) {
  const data = safe(content);
  const jobQ = useVideoJob(data.job_id ?? '');
  const cancelJob = useCancelVideoJob();

  const live = jobQ.data;
  const resolved = live ?? data;

  const status = resolved.status ?? 'unknown';
  const url = resolved.url ?? '';
  const progress = resolved.progress ?? 0;
  const prompt = resolved.prompt ?? data.prompt ?? '';
  const durationS = resolved.duration_s ?? 0;
  const error = resolved.error ?? '';

  const isActive = status === 'pending' || status === 'running' || status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed' || status === 'cancelled';

  return (
    <div className="rounded-xl border border-indigo-300/30 bg-indigo-50/80 dark:border-indigo-700/40 dark:bg-indigo-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-200/40 dark:border-indigo-800/40">
        <Film className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Video Generation
        </span>
        <span
          className={cn(
            'ml-1 text-[10px] rounded-full border px-2 py-0.5 font-medium',
            isActive && 'border-amber-300/50 bg-amber-100/60 text-amber-600 dark:border-amber-700/50 dark:bg-amber-900/40 dark:text-amber-400',
            isCompleted && 'border-emerald-300/50 bg-emerald-100/60 text-emerald-600 dark:border-emerald-700/50 dark:bg-emerald-900/40 dark:text-emerald-400',
            isFailed && 'border-rose-300/50 bg-rose-100/60 text-rose-600 dark:border-rose-700/50 dark:bg-rose-900/40 dark:text-rose-400',
          )}
        >
          {status}
        </span>
        {durationS > 0 && isCompleted && (
          <span className="ml-auto text-[10px] text-indigo-500/70 dark:text-indigo-400/60">
            {durationS}s
          </span>
        )}
      </div>

      {/* Prompt summary */}
      {prompt && (
        <div className="px-4 py-2 text-xs text-indigo-600/80 dark:text-indigo-300/70 border-b border-indigo-200/20 dark:border-indigo-800/20">
          <span className="font-medium text-indigo-700 dark:text-indigo-300">Prompt:</span>{' '}
          {prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt}
        </div>
      )}

      {/* Progress */}
      {isActive && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            <span className="text-xs text-indigo-600 dark:text-indigo-400">
              Generating video… {progress > 0 ? `${Math.round(progress)}%` : ''}
            </span>
          </div>
          {progress > 0 && (
            <div className="h-1.5 w-full rounded-full bg-indigo-200/50 dark:bg-indigo-800/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          {data.job_id && (
            <button
              type="button"
              onClick={() => cancelJob.mutate(data.job_id!)}
              disabled={cancelJob.isPending}
              className="mt-2 text-[10px] text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 disabled:opacity-50"
            >
              Cancel generation
            </button>
          )}
        </div>
      )}

      {/* Completed — video player */}
      {isCompleted && url && (
        <div className="p-3">
          <video
            src={url}
            controls
            preload="metadata"
            className="w-full rounded-lg bg-black"
            aria-label={prompt ? `Generated video: ${prompt}` : 'Generated video'}
          >
            <track kind="captions" />
            Your browser does not support video playback.
          </video>
        </div>
      )}

      {/* Completed — no URL yet */}
      {isCompleted && !url && (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          Video generated — download link pending
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
          <XCircle className="h-4 w-4" />
          {error || `Video generation ${status}`}
        </div>
      )}
    </div>
  );
}

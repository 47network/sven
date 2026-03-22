'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Wrench, CheckCircle2, XCircle, Clock, Loader2, ExternalLink,
} from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface ToolCardBlockProps {
  content: {
    tool_name?: string;
    run_id?: string;
    status?: 'running' | 'success' | 'error' | 'timeout' | 'denied' | 'blocked' | 'executed' | 'pending_approval';
    duration_ms?: number;
    inputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    error?: string;
    created_at?: string;
    approval_id?: string;
  };
  metadata?: Record<string, unknown>;
  chatId?: string;
  messageId?: string;
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  timeout: Clock,
  running: Loader2,
  denied: XCircle,
  blocked: XCircle,
  executed: CheckCircle2,
  pending_approval: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  timeout: 'text-amber-600 dark:text-amber-400',
  running: 'text-blue-600 dark:text-blue-400 animate-spin',
  denied: 'text-red-600 dark:text-red-400',
  blocked: 'text-red-600 dark:text-red-400',
  executed: 'text-green-600 dark:text-green-400',
  pending_approval: 'text-amber-600 dark:text-amber-400',
};

function formatStatus(status: string): string {
  if (status === 'pending_approval') return 'pending approval';
  if (status === 'executed') return 'executed';
  if (status === 'blocked') return 'blocked';
  return status;
}

export function ToolCardBlock({ content, chatId, messageId }: ToolCardBlockProps) {
  const {
    tool_name = 'unknown',
    run_id,
    status = 'running',
    duration_ms,
    inputs,
    outputs,
    error,
    created_at,
    approval_id,
  } = content || {};

  const StatusIcon = STATUS_ICONS[status] || Wrench;
  const [voteState, setVoteState] = useState<'idle' | 'approve' | 'reject' | 'done'>('idle');

  async function emitInteraction(decision: 'approve' | 'reject') {
    if (!chatId) return;
    try {
      await api.a2ui.interact(chatId, {
        event_type: 'action',
        payload: {
          message_id: messageId,
          action: decision,
          approval_id,
          source: 'tool_card',
        },
      });
    } catch {
      // ignore
    }
  }

  async function handleVote(decision: 'approve' | 'reject') {
    if (!approval_id || voteState !== 'idle') return;
    setVoteState(decision);
    try {
      await api.approvals.vote(approval_id, decision === 'approve' ? 'approve' : 'deny');
      await emitInteraction(decision);
      setVoteState('done');
    } catch {
      toast.error('Approval vote failed');
      setVoteState('done');
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 dark:bg-slate-800">
        <Wrench className="h-4 w-4 text-[var(--fg-muted)]" />
        <span className="text-sm font-medium">{tool_name}</span>
        <StatusIcon className={cn('h-4 w-4 ml-auto', STATUS_COLORS[status])} />
        <span className="text-xs text-[var(--fg-muted)] capitalize">{formatStatus(status)}</span>
        {run_id && (
          <Link
            href={`/runs/${run_id}`}
            className="text-[var(--fg-muted)] hover:text-brand-600"
            title="View run details"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="px-4 py-3 space-y-2 text-sm">
        {/* Duration */}
        {duration_ms != null && (
          <div className="text-xs text-[var(--fg-muted)]">
            Duration: {duration_ms < 1000 ? `${duration_ms}ms` : `${(duration_ms / 1000).toFixed(1)}s`}
            {created_at && <span className="ml-3">{relativeTime(created_at)}</span>}
          </div>
        )}

        {/* Inputs */}
        {inputs && Object.keys(inputs).length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
              Inputs
            </summary>
            <pre className="mt-1 rounded bg-slate-100 p-2 text-xs overflow-x-auto dark:bg-slate-900 font-mono">
              {JSON.stringify(inputs, null, 2)}
            </pre>
          </details>
        )}

        {/* Outputs */}
        {outputs && Object.keys(outputs).length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
              Outputs
            </summary>
            <pre className="mt-1 rounded bg-slate-100 p-2 text-xs overflow-x-auto dark:bg-slate-900 font-mono">
              {JSON.stringify(outputs, null, 2)}
            </pre>
          </details>
        )}

        {/* Error */}
        {error && (
          <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {status === 'pending_approval' && approval_id && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              onClick={() => void handleVote('approve')}
              disabled={voteState !== 'idle'}
            >
              {voteState === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Approve
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-rose-300/60 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
              onClick={() => void handleVote('reject')}
              disabled={voteState !== 'idle'}
            >
              {voteState === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

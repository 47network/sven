'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useToolRun } from '@/lib/hooks';
import type { ToolRunLinkedArtifact } from '@/lib/api';
import { PageSpinner } from '@/components/Spinner';
import {
  Wrench, CheckCircle2, XCircle, Clock, Loader2,
  ArrowLeft, Copy, ExternalLink, FileText,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-600', label: 'Success' },
  error: { icon: XCircle, color: 'text-red-600', label: 'Error' },
  timeout: { icon: Clock, color: 'text-amber-600', label: 'Timeout' },
  running: { icon: Loader2, color: 'text-blue-600 animate-spin', label: 'Running' },
  denied: { icon: XCircle, color: 'text-red-600', label: 'Denied' },
};

export default function ToolRunPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useToolRun(id);
  const router = useRouter();

  if (isLoading) {
    return <AppShell><PageSpinner /></AppShell>;
  }

  if (!run) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-[var(--fg-muted)]">Tool run not found</p>
        </div>
      </AppShell>
    );
  }

  const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.error;
  const StatusIcon = config.icon;
  const toolLogs = run.tool_logs;

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-md p-2 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Wrench className="h-6 w-6 text-[var(--fg-muted)]" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{run.tool_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusIcon className={cn('h-4 w-4', config.color)} />
              <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
              {run.duration_ms != null && (
                <span className="text-sm text-[var(--fg-muted)]">
                  • {run.duration_ms < 1000 ? `${run.duration_ms}ms` : `${(run.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
            {run.chat_id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/c/${run.chat_id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  Open related chat
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {run.context_message_id && (
                  <Link
                    href={`/c/${run.chat_id}?m=${encodeURIComponent(String(run.context_message_id || ''))}`}
                    className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-cyan-900/20"
                  >
                    Open run context
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="card">
          <h3 className="text-sm font-medium mb-3">Run Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--fg-muted)]">Run ID</span>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="font-mono text-xs break-all">{run.id}</p>
                <button
                  type="button"
                  className="rounded p-1 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void copyText(String(run.id || ''), 'Run ID')}
                  title="Copy run ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">Chat</span>
              <p>
                <Link href={`/c/${run.chat_id}`} className="text-brand-600 hover:underline font-mono text-xs">
                  {run.chat_id}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">Started</span>
              <p className="font-medium">{formatDate(run.created_at)}</p>
            </div>
            {run.completed_at && (
              <div>
                <span className="text-[var(--fg-muted)]">Completed</span>
                <p className="font-medium">{formatDate(run.completed_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Audit hashes */}
        <div className="card">
          <h3 className="text-sm font-medium mb-3">Audit Chain</h3>
          <div className="space-y-2 text-xs font-mono">
            <div>
              <span className="text-[var(--fg-muted)]">prev_hash:</span>{' '}
              <span className="break-all">{run.prev_hash}</span>
              {!!run.prev_hash && (
                <button
                  type="button"
                  className="ml-1 rounded p-1 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void copyText(String(run.prev_hash), 'prev_hash')}
                  title="Copy prev_hash"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">run_hash:</span>{' '}
              <span className="break-all">{run.run_hash}</span>
              {!!run.run_hash && (
                <button
                  type="button"
                  className="ml-1 rounded p-1 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void copyText(String(run.run_hash), 'run_hash')}
                  title="Copy run_hash"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
            <div>
              <span className="text-[var(--fg-muted)]">canonical_io_sha256:</span>{' '}
              <span className="break-all">{run.canonical_io_sha256}</span>
              {!!run.canonical_io_sha256 && (
                <button
                  type="button"
                  className="ml-1 rounded p-1 text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => void copyText(String(run.canonical_io_sha256), 'canonical_io_sha256')}
                  title="Copy canonical hash"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inputs */}
        {run.inputs && Object.keys(run.inputs).length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium mb-2">Inputs</h3>
            <pre className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs overflow-x-auto font-mono">
              {JSON.stringify(run.inputs, null, 2)}
            </pre>
          </div>
        )}

        {/* Outputs */}
        {run.outputs && Object.keys(run.outputs).length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium mb-2">Outputs</h3>
            <pre className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs overflow-x-auto font-mono">
              {JSON.stringify(run.outputs, null, 2)}
            </pre>
          </div>
        )}

        {Array.isArray(run.linked_artifacts) && run.linked_artifacts.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-medium mb-2">Linked Artifacts</h3>
            <div className="space-y-2">
              {run.linked_artifacts.map((artifact: ToolRunLinkedArtifact, index: number) => (
                <div
                  key={String(artifact.id || `artifact-${index}`)}
                  className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{String(artifact.name || 'artifact')}</div>
                    <div className="text-[11px] text-[var(--fg-muted)]">
                      {String(artifact.mime_type || 'application/octet-stream')}
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {artifact.chat_id && artifact.message_id && (
                      <Link
                        href={`/c/${artifact.chat_id}?m=${encodeURIComponent(String(artifact.message_id || ''))}`}
                        className="inline-flex items-center gap-1 rounded border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-900/20"
                      >
                        Context
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    <Link
                      href={`/artifacts/${artifact.id}`}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Artifact
                      <FileText className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {run.error && (
          <div className="card border-red-200 dark:border-red-800">
            <h3 className="text-sm font-medium text-red-600 mb-2">Error</h3>
            <pre className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs text-red-700 dark:text-red-400 overflow-x-auto font-mono">
              {run.error}
            </pre>
          </div>
        )}

        {/* Logs */}
        {toolLogs && (
          <div className="card">
            <h3 className="text-sm font-medium mb-2">Execution Logs</h3>
            {toolLogs.stdout && (
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--fg-muted)]">stdout</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                    onClick={() => void copyText(String(toolLogs.stdout), 'stdout')}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <pre className="mt-1 rounded-lg bg-slate-900 p-3 text-xs text-green-400 overflow-x-auto font-mono">
                  {toolLogs.stdout}
                </pre>
              </div>
            )}
            {toolLogs.stderr && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--fg-muted)]">stderr</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-700/40 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                    onClick={() => void copyText(String(toolLogs.stderr), 'stderr')}
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <pre className="mt-1 rounded-lg bg-slate-900 p-3 text-xs text-red-400 overflow-x-auto font-mono">
                  {toolLogs.stderr}
                </pre>
              </div>
            )}
            {toolLogs.exit_code != null && (
              <p className="mt-2 text-xs text-[var(--fg-muted)]">
                Exit code: <span className="font-mono">{toolLogs.exit_code}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

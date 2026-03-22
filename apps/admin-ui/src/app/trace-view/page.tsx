'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useToolRuns, useToolRun } from '@/lib/hooks';
import type { ToolRunRecord } from '@/lib/api';
import { ScanSearch, ChevronRight, Sparkles, ArrowUpRight, ClipboardCopy, X } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function TraceViewPageContent() {
  const searchParams = useSearchParams();
  const chatIdFilter = searchParams?.get('chatId') || '';
  const { data, isLoading } = useToolRuns({ limit: 50, chat_id: chatIdFilter || undefined });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<'params' | 'output' | null>(null);
  const { data: detail, isLoading: detailLoading } = useToolRun(selectedId ?? '');

  if (isLoading) return <PageSpinner />;

  const rows: ToolRunRecord[] = data?.rows ?? [];
  const detailRecord =
    detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null;
  const detailToolName =
    detailRecord && typeof detailRecord.tool_name === 'string' ? detailRecord.tool_name : '—';
  const detailStatus =
    detailRecord && typeof detailRecord.status === 'string' ? detailRecord.status : 'pending';
  const detailDurationMs =
    detailRecord && typeof detailRecord.duration_ms === 'number' ? detailRecord.duration_ms : undefined;
  const detailChatId =
    detailRecord && typeof detailRecord.chat_id === 'string' ? detailRecord.chat_id : '—';
  const detailUserId =
    detailRecord && typeof detailRecord.user_id === 'string' ? detailRecord.user_id : '—';
  const detailStartedAt =
    detailRecord && typeof detailRecord.started_at === 'string' ? detailRecord.started_at : undefined;
  const detailInput = detailRecord?.input;
  const detailOutput = detailRecord?.output;
  const detailError = detailRecord?.error;
  const traceSteps: Array<{ name?: string; type?: string; duration_ms?: number; detail?: unknown; raw?: Record<string, unknown> }> =
    Array.isArray(detailRecord?.trace)
      ? detailRecord.trace
          .filter((step): step is Record<string, unknown> => typeof step === 'object' && step !== null)
          .map((step) => ({
            name: typeof step.name === 'string' ? step.name : undefined,
            type: typeof step.type === 'string' ? step.type : undefined,
            duration_ms: typeof step.duration_ms === 'number' ? step.duration_ms : undefined,
            detail: step.detail,
            raw: step,
          }))
      : [];
  const selectedStep = selectedStepIndex !== null ? traceSteps[selectedStepIndex] : null;
  const selectedStepRaw: Record<string, unknown> = (selectedStep?.raw && typeof selectedStep.raw === 'object')
    ? selectedStep.raw
    : {};
  const selectedStepToolName = String(
    selectedStepRaw.tool_name ||
    selectedStepRaw.tool ||
    selectedStep?.name ||
    selectedStep?.type ||
    detailToolName ||
    'Tool Step',
  );
  const selectedStepStatus = String(selectedStepRaw.status || detailStatus || 'unknown');
  const selectedStepDuration = Number(
    typeof selectedStepRaw.duration_ms === 'number'
      ? selectedStepRaw.duration_ms
      : (selectedStep?.duration_ms ?? 0),
  );
  const selectedStepParameters = selectedStepRaw.parameters ?? selectedStepRaw.params ?? selectedStepRaw.input ?? selectedStep?.detail ?? detailInput ?? null;
  const selectedStepOutput = selectedStepRaw.output ?? selectedStepRaw.result ?? selectedStepRaw.response ?? detailOutput ?? null;
  const hasLargeParams = JSON.stringify(selectedStepParameters ?? '').length > 220;
  const hasLargeOutput = JSON.stringify(selectedStepOutput ?? '').length > 220;
  const formattedSelectedParams = useMemo(
    () => (selectedStepParameters === null ? 'null' : JSON.stringify(selectedStepParameters, null, 2)),
    [selectedStepParameters],
  );
  const formattedSelectedOutput = useMemo(
    () => (selectedStepOutput === null ? 'null' : JSON.stringify(selectedStepOutput, null, 2)),
    [selectedStepOutput],
  );

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        setSelectedStepIndex(null);
      }
    }
    if (selectedStepIndex !== null) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    return undefined;
  }, [selectedStepIndex]);

  async function copyText(target: 'params' | 'output', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1200);
    } catch {
      setCopiedTarget(null);
    }
  }
  const successCount = rows.filter((r) => r.status === 'success').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return (
    <>
      <PageHeader title="Trace View" description="Message-level execution traces for debugging" />
      {chatIdFilter && (
        <div className="mb-4 text-xs text-slate-500">
          Filtering by chat:
          {' '}
          <span className="badge badge-info">{chatIdFilter}</span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Debug Command
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Trace Explorer</h2>
              <p className="mt-1 text-sm text-slate-400">
                Inspect step-level execution data and payload transitions.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Loaded</p>
              <p className="text-lg font-semibold text-cyan-300">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Success</p>
              <p className="text-lg font-semibold text-emerald-300">{successCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Errors</p>
              <p className="text-lg font-semibold text-red-300">{errorCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Steps</p>
              <p className="text-lg font-semibold text-amber-300">{traceSteps.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/runs" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Tool Runs</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/audit-verifier" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Audit Verifier</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/incidents" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Incident Center</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run list */}
        <div className="lg:col-span-1">
          <div className="card max-h-[calc(100vh-12rem)] overflow-y-auto p-0">
            {rows.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={ScanSearch} title="No traces" description="Run a tool to see its trace." />
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                        selectedId === r.id ? 'bg-brand-50 dark:bg-brand-950' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium font-mono">{r.tool_name}</p>
                        <p className="text-xs text-slate-500">
                          {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            r.status === 'success'
                              ? 'badge-success'
                              : r.status === 'error'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }
                        >
                          {r.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Trace detail */}
        <div className="lg:col-span-2">
          {selectedId === null ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <ScanSearch className="mb-3 h-12 w-12" />
              <p>Select a tool run to view its trace</p>
            </div>
          ) : detailLoading ? (
            <PageSpinner />
          ) : (
            <div className="card space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{detailToolName}</h3>
                <span
                  className={
                    detailStatus === 'success'
                      ? 'badge-success'
                      : detailStatus === 'error'
                        ? 'badge-danger'
                        : 'badge-warning'
                  }
                >
                  {detailStatus}
                </span>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Duration</p>
                  <p className="font-medium">{detailDurationMs ? `${detailDurationMs}ms` : '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Chat</p>
                  <p className="font-medium font-mono text-xs">{detailChatId}</p>
                </div>
                <div>
                  <p className="text-slate-500">User</p>
                  <p className="font-medium">{detailUserId}</p>
                </div>
                <div>
                  <p className="text-slate-500">Started</p>
                  <p className="font-medium">{detailStartedAt ? new Date(detailStartedAt).toLocaleString() : '—'}</p>
                </div>
              </div>

              {/* Input */}
              {Boolean(detailInput) && (
                <div>
                  <p className="mb-1 text-sm font-medium">Input</p>
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs font-mono dark:bg-slate-800">
                    {typeof detailInput === 'string' ? detailInput : JSON.stringify(detailInput, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output */}
              {Boolean(detailOutput) && (
                <div>
                  <p className="mb-1 text-sm font-medium">Output</p>
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs font-mono dark:bg-slate-800">
                    {typeof detailOutput === 'string' ? detailOutput : JSON.stringify(detailOutput, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {Boolean(detailError) && (
                <div>
                  <p className="mb-1 text-sm font-medium text-red-600">Error</p>
                  <pre className="overflow-auto rounded-md bg-red-50 p-3 text-xs font-mono text-red-800 dark:bg-red-950 dark:text-red-300">
                    {typeof detailError === 'string' ? detailError : JSON.stringify(detailError, null, 2)}
                  </pre>
                </div>
              )}

              {/* Trace steps */}
              {traceSteps.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Trace Steps</p>
                  <div className="space-y-2">
                    {traceSteps.map((step, i: number) => (
                      <button
                        key={i}
                        type="button"
                        data-testid="trace-step-row"
                        onClick={() => setSelectedStepIndex(i)}
                        className="flex w-full items-start gap-3 rounded-md bg-slate-50 p-3 text-left text-sm transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium">{step.name ?? step.type ?? `Step ${i + 1}`}</p>
                          {step.duration_ms && (
                            <p className="text-xs text-slate-500">{step.duration_ms}ms</p>
                          )}
                          {Boolean(step.detail) && (
                            <p className="mt-1 text-xs text-slate-500">{JSON.stringify(step.detail)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {selectedStep && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          onClick={() => setSelectedStepIndex(null)}
          data-testid="trace-step-modal-overlay"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            data-testid="trace-step-modal"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Step Detail</p>
                <h3 className="text-lg font-semibold" data-testid="trace-step-modal-tool-name">{selectedStepToolName}</h3>
                <p className="text-xs text-slate-500">
                  Status: <span data-testid="trace-step-modal-status">{selectedStepStatus}</span>
                  {' '}· Duration: <span>{selectedStepDuration > 0 ? `${selectedStepDuration}ms` : '—'}</span>
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setSelectedStepIndex(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">Parameters</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    onClick={() => void copyText('params', formattedSelectedParams)}
                    data-testid="trace-step-copy-params"
                  >
                    <ClipboardCopy className="h-3 w-3" />
                    {copiedTarget === 'params' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {hasLargeParams ? (
                  <details open className="rounded-md border border-slate-200 dark:border-slate-700">
                    <summary className="cursor-pointer px-3 py-2 text-xs text-slate-500">Show parameters JSON</summary>
                    <pre className="overflow-auto border-t border-slate-200 bg-slate-50 p-3 text-xs font-mono dark:border-slate-700 dark:bg-slate-800">{formattedSelectedParams}</pre>
                  </details>
                ) : (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs font-mono dark:bg-slate-800">{formattedSelectedParams}</pre>
                )}
              </section>

              <section>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">Output</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    onClick={() => void copyText('output', formattedSelectedOutput)}
                    data-testid="trace-step-copy-output"
                  >
                    <ClipboardCopy className="h-3 w-3" />
                    {copiedTarget === 'output' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {hasLargeOutput ? (
                  <details open className="rounded-md border border-slate-200 dark:border-slate-700">
                    <summary className="cursor-pointer px-3 py-2 text-xs text-slate-500">Show output JSON</summary>
                    <pre className="overflow-auto border-t border-slate-200 bg-slate-50 p-3 text-xs font-mono dark:border-slate-700 dark:bg-slate-800">{formattedSelectedOutput}</pre>
                  </details>
                ) : (
                  <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs font-mono dark:bg-slate-800">{formattedSelectedOutput}</pre>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TraceViewPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <TraceViewPageContent />
    </Suspense>
  );
}

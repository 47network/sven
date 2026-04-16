'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useWorkflows, useWorkflowRuns } from '@/lib/hooks';
import { ListChecks, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

type WorkflowRow = {
  id: string;
  name: string;
};

type WorkflowRunStep = {
  name: string;
  status: string;
  error: string;
  duration_ms: number | null;
};

type WorkflowRunRow = {
  id: string;
  status: string;
  workflow_name: string;
  started_at: string;
  duration_ms: number | null;
  steps: WorkflowRunStep[];
};

function toWorkflowRows(value: unknown): WorkflowRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Workflow'),
    }));
}

function toWorkflowRunRows(value: unknown): WorkflowRunRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => {
      const stepsRaw = Array.isArray(item.steps) ? item.steps : [];
      const steps = stepsRaw
        .map((step) => (step && typeof step === 'object' ? (step as Record<string, unknown>) : null))
        .filter((step): step is Record<string, unknown> => step !== null)
        .map((step) => ({
          name: String(step.name ?? ''),
          status: String(step.status ?? 'pending'),
          error: String(step.error ?? ''),
          duration_ms: typeof step.duration_ms === 'number' ? step.duration_ms : null,
        }));

      return {
        id: String(item.id ?? ''),
        status: String(item.status ?? 'pending'),
        workflow_name: String(item.workflow_name ?? ''),
        started_at: String(item.started_at ?? ''),
        duration_ms: typeof item.duration_ms === 'number' ? item.duration_ms : null,
        steps,
      };
    });
}

function WorkflowRunsContent() {
  const searchParams = useSearchParams();
  const workflowParam = searchParams?.get('workflow') ?? '';
  const { data: workflows, isLoading: wfLoading } = useWorkflows();
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflowParam);
  const { data: runs, isLoading: runsLoading } = useWorkflowRuns(selectedWorkflow);

  if (wfLoading) return <PageSpinner />;

  const wfList = toWorkflowRows(workflows?.rows);
  const runList = toWorkflowRunRows(runs?.rows);

  function statusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  }

  return (
    <>
      <PageHeader title="Workflow Runs" description="Execution history with step-by-step timeline" />

      {/* Workflow selector */}
      <div className="mb-6">
        <select
          className="input w-64"
          value={selectedWorkflow}
          onChange={(e) => setSelectedWorkflow(e.target.value)}
        >
          <option value="">All workflows</option>
          {wfList.map((wf) => (
            <option key={wf.id} value={wf.id}>{wf.name}</option>
          ))}
        </select>
      </div>

      {runsLoading && selectedWorkflow ? (
        <PageSpinner />
      ) : runList.length === 0 ? (
        <EmptyState icon={ListChecks} title="No runs" description="Execute a workflow to see its run history here." />
      ) : (
        <div className="space-y-4">
          {runList.map((run) => (
            <div key={run.id} className="card py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(run.status)}
                  <div>
                    <p className="font-medium">{run.workflow_name ?? 'Workflow Run'}</p>
                    <p className="text-xs text-slate-500">
                      Started {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      {run.duration_ms ? ` · ${run.duration_ms}ms` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={
                    run.status === 'completed' ? 'badge-success' :
                    run.status === 'failed' ? 'badge-danger' : 'badge-warning'
                  }
                >
                  {run.status}
                </span>
              </div>

              {/* Step timeline */}
              {run.steps && run.steps.length > 0 && (
                <div className="mt-4 ml-2 border-l-2 border-slate-200 dark:border-slate-700">
                  {run.steps.map((step, i: number) => (
                    <div key={i} className="relative ml-4 pb-4 last:pb-0">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-[1.3rem] top-0.5 h-3 w-3 rounded-full border-2 ${
                          step.status === 'completed'
                            ? 'border-green-500 bg-green-100 dark:bg-green-900'
                            : step.status === 'failed'
                              ? 'border-red-500 bg-red-100 dark:bg-red-900'
                              : step.status === 'running'
                                ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900'
                                : 'border-slate-300 bg-slate-100 dark:bg-slate-800'
                        }`}
                      />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{step.name ?? `Step ${i + 1}`}</p>
                          {Boolean(step.error) && (
                            <p className="mt-0.5 text-xs text-red-500">{step.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {Boolean(step.duration_ms) && <span>{step.duration_ms}ms</span>}
                          <span
                            className={
                              step.status === 'completed' ? 'badge-success' :
                              step.status === 'failed' ? 'badge-danger' : 'badge-neutral'
                            }
                          >
                            {step.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function WorkflowRunsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <WorkflowRunsContent />
    </Suspense>
  );
}

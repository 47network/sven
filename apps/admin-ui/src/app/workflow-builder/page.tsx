'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useChats, useCreateWorkflow, useExecuteWorkflow, useToggleWorkflow, useWorkflows } from '@/lib/hooks';
import { Workflow, Plus, Play, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type WorkflowStep = {
  name: string;
  type: string;
};

type WorkflowRow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  step_count: number;
  run_count: number;
  last_run_at: string;
  steps: WorkflowStep[];
};

function toWorkflowRows(value: unknown): WorkflowRow[] {
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
          type: String(step.type ?? ''),
        }));

      return {
        id: String(item.id ?? ''),
        name: String(item.name ?? 'Workflow'),
        description: String(item.description ?? 'No description'),
        enabled: Boolean(item.enabled),
        step_count: Number(item.step_count ?? 0),
        run_count: Number(item.run_count ?? 0),
        last_run_at: String(item.last_run_at ?? ''),
        steps,
      };
    });
}

export default function WorkflowBuilderPage() {
  const { data, isLoading } = useWorkflows();
  const { data: chats } = useChats();
  const createWorkflow = useCreateWorkflow();
  const executeWorkflow = useExecuteWorkflow();
  const toggleWorkflow = useToggleWorkflow();

  if (isLoading) return <PageSpinner />;

  const rows = toWorkflowRows(data?.rows);
  const chatRows = Array.isArray(chats?.rows) ? chats.rows : [];

  function handleCreateWorkflow() {
    const defaultChatId = String((chatRows[0] as { id?: string } | undefined)?.id ?? '');
    if (!defaultChatId) {
      toast.error('Create a chat first before creating workflows.');
      return;
    }

    const name = window.prompt('Workflow name', 'New Workflow');
    if (!name || !name.trim()) return;
    const description = window.prompt('Workflow description (optional)', '') ?? '';

    createWorkflow.mutate(
      {
        chat_id: defaultChatId,
        name: name.trim(),
        description: description.trim(),
        steps: [],
        edges: [],
        is_draft: true,
      },
      {
        onSuccess: () => toast.success('Workflow created'),
        onError: () => toast.error('Failed to create workflow'),
      },
    );
  }

  function handleExecuteWorkflow(id: string) {
    executeWorkflow.mutate(
      { id },
      {
        onSuccess: () => toast.success('Workflow execution started'),
        onError: () => toast.error('Failed to start workflow'),
      },
    );
  }

  function handleToggleWorkflow(id: string, enabled: boolean) {
    toggleWorkflow.mutate(
      { id, enabled },
      {
        onSuccess: () => toast.success(enabled ? 'Workflow enabled' : 'Workflow disabled'),
        onError: () => toast.error('Failed to update workflow'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Workflow Builder" description="Create, run, and manage workflow definitions">
        <button
          onClick={handleCreateWorkflow}
          disabled={createWorkflow.isPending}
          className="btn-primary flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> New Workflow
        </button>
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows"
          description="Create a workflow to automate multi-step operations."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((wf) => (
            <div key={wf.id} className="card py-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{wf.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{wf.description}</p>
                </div>
                <span className={wf.enabled ? 'badge-success' : 'badge-neutral'}>
                  {wf.enabled ? 'active' : 'disabled'}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                <span>{wf.step_count ?? 0} steps</span>
                <span>{wf.run_count ?? 0} runs</span>
                {wf.last_run_at && (
                  <span>Last: {new Date(wf.last_run_at).toLocaleDateString()}</span>
                )}
              </div>

              {/* Steps preview */}
              {wf.steps && wf.steps.length > 0 && (
                <div className="mt-3 flex items-center gap-1 overflow-x-auto">
                  {wf.steps.slice(0, 5).map((step, i: number) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                        {step.name ?? step.type}
                      </span>
                    </span>
                  ))}
                  {wf.steps.length > 5 && (
                    <span className="text-xs text-slate-400">+{wf.steps.length - 5} more</span>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleExecuteWorkflow(wf.id)}
                  disabled={executeWorkflow.isPending || !wf.enabled}
                  className="btn-primary btn-sm flex items-center gap-1"
                >
                  <Play className="h-3.5 w-3.5" /> Run
                </button>
                <button
                  onClick={() => handleToggleWorkflow(wf.id, !wf.enabled)}
                  disabled={toggleWorkflow.isPending}
                  className="btn-secondary btn-sm"
                >
                  {wf.enabled ? 'Disable' : 'Enable'}
                </button>
                <Link href={`/workflow-runs?workflow=${wf.id}`} className="btn-secondary btn-sm">
                  View Runs
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

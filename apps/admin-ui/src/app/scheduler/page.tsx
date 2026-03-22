'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useAgents,
  useSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
  useRunSchedule,
  useScheduleHistory,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Clock3, Play, Trash2, Pencil, History } from 'lucide-react';
import type { ScheduleRecord, ScheduleRunRecord } from '@/lib/api';

type AgentRow = { id: string; name?: string };

type ScheduleFormState = {
  name: string;
  instruction: string;
  schedule_type: 'once' | 'recurring';
  expression: string;
  run_at: string;
  timezone: string;
  agent_id: string;
  chat_id: string;
  max_runs: string;
  missed_policy: 'skip' | 'run_immediately';
  enabled: boolean;
  notify_channels: Array<'in_app' | 'email' | 'slack' | 'webhook'>;
  notify_email_to: string;
  notify_webhook_url: string;
  notify_slack_webhook_url: string;
};

type SchedulePayload = {
  name: string;
  instruction: string;
  schedule_type: 'once' | 'recurring';
  expression?: string;
  run_at?: string;
  timezone?: string;
  enabled?: boolean;
  agent_id?: string;
  chat_id?: string;
  max_runs?: number;
  missed_policy?: 'skip' | 'run_immediately';
  notify_channels?: Array<'in_app' | 'email' | 'slack' | 'webhook'>;
  notify_email_to?: string;
  notify_webhook_url?: string;
  notify_slack_webhook_url?: string;
};

const DEFAULT_FORM: ScheduleFormState = {
  name: '',
  instruction: '',
  schedule_type: 'recurring',
  expression: '0 9 * * *',
  run_at: '',
  timezone: 'UTC',
  agent_id: '',
  chat_id: '',
  max_runs: '',
  missed_policy: 'skip',
  enabled: true,
  notify_channels: ['in_app'],
  notify_email_to: '',
  notify_webhook_url: '',
  notify_slack_webhook_url: '',
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function toLocalDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export default function SchedulerPage() {
  const schedulesQuery = useSchedules();
  const agentsQuery = useAgents();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const runSchedule = useRunSchedule();

  const [form, setForm] = useState<ScheduleFormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const historyQuery = useScheduleHistory(historyId || '', 10);

  const agents = useMemo(() => (agentsQuery.data?.data || []) as AgentRow[], [agentsQuery.data?.data]);
  const agentLookup = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name || agent.id])), [agents]);

  if (schedulesQuery.isLoading || agentsQuery.isLoading) return <PageSpinner />;

  const schedules = (schedulesQuery.data?.data || []) as ScheduleRecord[];
  const historyRuns = (historyQuery.data?.data || []) as ScheduleRunRecord[];

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  function handleEdit(task: ScheduleRecord) {
    setEditingId(task.id);
    setForm({
      name: task.name || '',
      instruction: task.instruction || '',
      schedule_type: task.schedule_type || 'recurring',
      expression: task.expression || '0 9 * * *',
      run_at: toLocalDateInput(task.run_at),
      timezone: task.timezone || 'UTC',
      agent_id: task.agent_id || '',
      chat_id: task.chat_id || '',
      max_runs: task.max_runs != null ? String(task.max_runs) : '',
      missed_policy: (task.missed_policy as 'skip' | 'run_immediately') || 'skip',
      enabled: task.enabled !== false,
      notify_channels: Array.isArray(task.notify_channels) ? task.notify_channels : ['in_app'],
      notify_email_to: task.notify_email_to || '',
      notify_webhook_url: task.notify_webhook_url || '',
      notify_slack_webhook_url: task.notify_slack_webhook_url || '',
    });
  }

  function buildPayload(): SchedulePayload {
    const payload: SchedulePayload = {
      name: form.name.trim(),
      instruction: form.instruction.trim(),
      schedule_type: form.schedule_type,
      timezone: form.timezone || 'UTC',
      agent_id: form.agent_id || undefined,
      chat_id: form.chat_id || undefined,
      missed_policy: form.missed_policy,
      enabled: form.enabled,
      notify_channels: form.notify_channels,
      notify_email_to: form.notify_email_to.trim() || undefined,
      notify_webhook_url: form.notify_webhook_url.trim() || undefined,
      notify_slack_webhook_url: form.notify_slack_webhook_url.trim() || undefined,
    };

    if (form.schedule_type === 'recurring') {
      payload.expression = form.expression.trim();
    }
    if (form.schedule_type === 'once') {
      if (form.run_at) {
        const runAt = new Date(form.run_at);
        if (!Number.isNaN(runAt.getTime())) {
          payload.run_at = runAt.toISOString();
        }
      }
    }
    if (form.max_runs) {
      const parsed = Number(form.max_runs);
      if (!Number.isNaN(parsed)) payload.max_runs = parsed;
    }

    return payload;
  }

  function handleSave() {
    if (!form.name.trim() || !form.instruction.trim()) {
      toast.error('Name and instruction are required');
      return;
    }
    if (form.schedule_type === 'recurring' && !form.expression.trim()) {
      toast.error('Cron expression is required');
      return;
    }
    if (form.schedule_type === 'once' && !form.run_at) {
      toast.error('Run time is required for one-time schedules');
      return;
    }
    if (form.notify_channels.includes('email') && !form.notify_email_to.trim()) {
      toast.error('Email destination is required when email notifications are enabled');
      return;
    }
    if (form.notify_channels.includes('webhook') && !form.notify_webhook_url.trim()) {
      toast.error('Webhook URL is required when webhook notifications are enabled');
      return;
    }
    if (form.notify_channels.includes('slack') && !form.notify_slack_webhook_url.trim()) {
      toast.error('Slack webhook URL is required when Slack notifications are enabled');
      return;
    }

    const payload = buildPayload();

    if (editingId) {
      updateSchedule.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast.success('Schedule updated');
            resetForm();
          },
          onError: () => toast.error('Failed to update schedule'),
        },
      );
      return;
    }

    createSchedule.mutate(payload, {
      onSuccess: () => {
        toast.success('Schedule created');
        resetForm();
      },
      onError: () => toast.error('Failed to create schedule'),
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this scheduled task?')) return;
    deleteSchedule.mutate(id, {
      onSuccess: () => toast.success('Schedule deleted'),
      onError: () => toast.error('Failed to delete schedule'),
    });
  }

  function toggleHistory(id: string) {
    setHistoryId((prev) => (prev === id ? null : id));
  }

  function toggleNotifyChannel(channel: 'in_app' | 'email' | 'slack' | 'webhook') {
    setForm((prev) => {
      const has = prev.notify_channels.includes(channel);
      return {
        ...prev,
        notify_channels: has
          ? prev.notify_channels.filter((c) => c !== channel)
          : [...prev.notify_channels, channel],
      };
    });
  }

  return (
    <>
      <PageHeader title="Scheduler" description="Create one-time or recurring agent tasks." />

      <div className="card mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{editingId ? 'Edit Schedule' : 'Create Schedule'}</h3>
          {editingId ? (
            <button className="btn-secondary btn-sm" onClick={resetForm}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <select
            className="input"
            value={form.schedule_type}
            disabled={Boolean(editingId)}
            onChange={(e) => setForm((p) => ({ ...p, schedule_type: e.target.value as 'once' | 'recurring' }))}
          >
            <option value="recurring">Recurring (cron)</option>
            <option value="once">One-time</option>
          </select>
          <textarea
            className="input min-h-[88px] md:col-span-2"
            placeholder="Instruction for the agent"
            value={form.instruction}
            onChange={(e) => setForm((p) => ({ ...p, instruction: e.target.value }))}
          />

          {form.schedule_type === 'recurring' ? (
            <input
              className="input"
              placeholder="Cron expression (e.g. 0 9 * * 1)"
              value={form.expression}
              onChange={(e) => setForm((p) => ({ ...p, expression: e.target.value }))}
            />
          ) : (
            <input
              className="input"
              type="datetime-local"
              value={form.run_at}
              onChange={(e) => setForm((p) => ({ ...p, run_at: e.target.value }))}
            />
          )}

          <input
            className="input"
            placeholder="Timezone (UTC)"
            value={form.timezone}
            onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
          />

          <select
            className="input"
            value={form.agent_id}
            onChange={(e) => setForm((p) => ({ ...p, agent_id: e.target.value }))}
          >
            <option value="">Default agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.id}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Chat ID (optional)"
            value={form.chat_id}
            onChange={(e) => setForm((p) => ({ ...p, chat_id: e.target.value }))}
          />

          <input
            className="input"
            placeholder="Max runs (optional)"
            value={form.max_runs}
            onChange={(e) => setForm((p) => ({ ...p, max_runs: e.target.value }))}
          />

          <select
            className="input"
            value={form.missed_policy}
            onChange={(e) => setForm((p) => ({ ...p, missed_policy: e.target.value as 'skip' | 'run_immediately' }))}
          >
            <option value="skip">Skip missed runs</option>
            <option value="run_immediately">Run missed immediately</option>
          </select>
        </div>

        <div className="space-y-2 rounded-md border border-slate-800 p-3">
          <p className="text-sm font-medium text-slate-200">Task Notifications</p>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notify_channels.includes('in_app')}
                onChange={() => toggleNotifyChannel('in_app')}
              />
              In-app
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notify_channels.includes('email')}
                onChange={() => toggleNotifyChannel('email')}
              />
              Email
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notify_channels.includes('slack')}
                onChange={() => toggleNotifyChannel('slack')}
              />
              Slack
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notify_channels.includes('webhook')}
                onChange={() => toggleNotifyChannel('webhook')}
              />
              Webhook
            </label>
          </div>
          {form.notify_channels.includes('email') ? (
            <input
              className="input"
              placeholder="Email destination (alerts@example.com)"
              value={form.notify_email_to}
              onChange={(e) => setForm((p) => ({ ...p, notify_email_to: e.target.value }))}
            />
          ) : null}
          {form.notify_channels.includes('slack') ? (
            <input
              className="input"
              placeholder="Slack webhook URL"
              value={form.notify_slack_webhook_url}
              onChange={(e) => setForm((p) => ({ ...p, notify_slack_webhook_url: e.target.value }))}
            />
          ) : null}
          {form.notify_channels.includes('webhook') ? (
            <input
              className="input"
              placeholder="Webhook URL"
              value={form.notify_webhook_url}
              onChange={(e) => setForm((p) => ({ ...p, notify_webhook_url: e.target.value }))}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            Enabled
          </label>
          <button className="btn-primary" onClick={handleSave} disabled={createSchedule.isPending || updateSchedule.isPending}>
            {editingId ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="card text-sm text-slate-400">No schedules yet.</div>
        ) : (
          schedules.map((task) => {
            const scheduleLabel = task.schedule_type === 'once'
              ? `Once at ${formatDate(task.run_at)}`
              : task.expression || '-';
            const status = task.last_status || '-';
            const enabled = task.enabled !== false;

            return (
              <div key={task.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{task.schedule_type}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                      <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                      {scheduleLabel}
                    </p>
                    <p className="text-sm text-slate-500">
                      Next: {formatDate(task.next_run)} / Last: {formatDate(task.last_run)} / Status: {status}
                    </p>
                    {task.agent_id ? (
                      <p className="text-xs text-slate-500">Agent: {agentLookup.get(task.agent_id) || task.agent_id}</p>
                    ) : null}
                    {task.chat_id ? (
                      <p className="text-xs text-slate-500">Chat: {task.chat_id}</p>
                    ) : null}
                    {Array.isArray(task.notify_channels) && task.notify_channels.length > 0 ? (
                      <p className="text-xs text-slate-500">Notify: {task.notify_channels.join(', ')}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => runSchedule.mutate(task.id, { onSuccess: () => toast.success('Schedule triggered') })}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" /> Run Now
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => handleEdit(task)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => updateSchedule.mutate(
                        { id: task.id, data: { enabled: !enabled } },
                        { onSuccess: () => toast.success(enabled ? 'Schedule disabled' : 'Schedule enabled') },
                      )}
                    >
                      {enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => toggleHistory(task.id)}
                    >
                      <History className="mr-1 h-3.5 w-3.5" /> History
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>

                {historyId === task.id ? (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-300">Last 10 Runs</h4>
                    {historyQuery.isLoading ? (
                      <p className="text-sm text-slate-400">Loading history...</p>
                    ) : historyRuns.length === 0 ? (
                      <p className="text-sm text-slate-400">No runs recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {historyRuns.map((run) => (
                          <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium capitalize">{run.status || 'unknown'}</p>
                              <p className="text-xs text-slate-500">
                                Started {formatDate(run.started_at)}
                                {run.duration_ms ? ` / ${Math.round(run.duration_ms)} ms` : ''}
                              </p>
                            </div>
                            {run.error ? (
                              <p className="text-xs text-red-400 max-w-[420px] truncate">{run.error}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
